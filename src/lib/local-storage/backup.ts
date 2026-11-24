import { clearLocalUserState } from "@/lib/local-user-state";
import {
  clearAllStores,
  getLocalProfile,
  getMapCacheEntries,
  isUsingMemoryFallback,
  listDiaryEntries,
  listWishlistEntries,
  replaceDiaryEntries,
  replaceLocalProfile,
  replaceWishlistEntries,
  upsertDiaryEntry,
  upsertWishlistEntry,
} from "./db";
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  BackupBundle,
  BackupBundleSchema,
  DiaryEntry,
  LocalProfile,
  MAX_BACKUP_BYTES,
  WishlistEntry,
} from "./schema";

export type BackupImportMode = "replace" | "merge";

export interface BackupIssue {
  path: string;
  message: string;
}

export type BackupParseResult =
  | { success: true; data: BackupBundle }
  | { success: false; error: string; issues?: BackupIssue[] };

export interface BackupImportResult {
  success: boolean;
  error?: string;
  issues?: BackupIssue[];
  imported?: {
    diaryCount: number;
    wishlistCount: number;
  };
}

export interface StorageBreakdown {
  bytes: number;
  count: number;
}

export interface LocalStorageUsageEstimate {
  usingMemoryFallback: boolean;
  totalBytes: number;
  stores: {
    profile: StorageBreakdown;
    diary: StorageBreakdown;
    wishlist: StorageBreakdown;
    mapCache: StorageBreakdown;
  };
  browserPreferencesBytes: number;
  browserSessionBytes: number;
  navigatorQuota?: {
    usage: number | null;
    quota: number | null;
  };
}

function measureUtf8Bytes(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  return Buffer.byteLength(text, "utf8");
}

function estimateWebStorageBytes(storage: Storage | undefined): number {
  if (!storage) return 0;
  try {
    let total = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null) continue;
      const val = storage.getItem(key) ?? "";
      total += measureUtf8Bytes(key) + measureUtf8Bytes(val);
    }
    return total;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Exports personal local data (profile, diary, wishlist) as a versioned bundle.
 * Ephemeral map cache is intentionally excluded.
 */
export async function exportBackupData(now: Date = new Date()): Promise<BackupBundle> {
  const [profile, diary, wishlist] = await Promise.all([
    getLocalProfile(now),
    listDiaryEntries(now.getTime()),
    listWishlistEntries(now.getTime()),
  ]);

  // Google Maps Platform ToS: never export Google-derived coordinates into persistent
  // portable JSON backups. Keep user-entered labels/notes and exempt place_id values.
  const sanitizedDiary = diary.map((entry) =>
    entry.coords_expires_at !== null
      ? { ...entry, latitude: null, longitude: null, coords_expires_at: null }
      : entry
  );
  const sanitizedWishlist = wishlist.map((entry) =>
    entry.coords_expires_at !== null
      ? { ...entry, latitude: null, longitude: null, coords_expires_at: null }
      : entry
  );

  return BackupBundleSchema.parse({
    schema_version: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_ID,
    exported_at: now.toISOString(),
    data: {
      profile,
      diary: sanitizedDiary,
      wishlist: sanitizedWishlist,
    },
  });
}

export async function serializeBackupJson(
  now: Date = new Date(),
  pretty: boolean = true
): Promise<string> {
  const bundle = await exportBackupData(now);
  return pretty ? JSON.stringify(bundle, null, 2) : JSON.stringify(bundle);
}

export function parseAndValidateBackupJson(rawJson: string): BackupParseResult {
  if (typeof rawJson !== "string" || rawJson.trim().length === 0) {
    return { success: false, error: "Il file di backup è vuoto." };
  }

  if (measureUtf8Bytes(rawJson) > MAX_BACKUP_BYTES) {
    return {
      success: false,
      error: `File di backup troppo grande (limite massimo ${formatBytes(MAX_BACKUP_BYTES)}).`,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { success: false, error: "Formato JSON non valido o file corrotto." };
  }

  const validation = BackupBundleSchema.safeParse(parsedJson);
  if (!validation.success) {
    return {
      success: false,
      error: "Struttura del backup non valida o versione non supportata.",
      issues: validation.error.issues.map((issue) => ({
        path: issue.path.join(".") || "root",
        message: issue.message,
      })),
    };
  }

  return { success: true, data: validation.data };
}

function pickNewerDiaryEntry(current: DiaryEntry, incoming: DiaryEntry): DiaryEntry {
  const currentTs = Date.parse(current.updated_at);
  const incomingTs = Date.parse(incoming.updated_at);
  return incomingTs >= currentTs ? incoming : current;
}

export async function importBackupData(
  rawJson: string,
  options: { mode?: BackupImportMode; now?: Date } = {}
): Promise<BackupImportResult> {
  const parsed = parseAndValidateBackupJson(rawJson);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      issues: parsed.issues,
    };
  }

  const mode = options.mode ?? "replace";
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const { profile, diary, wishlist } = parsed.data.data;

  if (mode === "replace") {
    await replaceLocalProfile(profile);
    const storedDiary = await replaceDiaryEntries(diary, nowMs);
    const storedWishlist = await replaceWishlistEntries(wishlist, nowMs);
    return {
      success: true,
      imported: {
        diaryCount: storedDiary.length,
        wishlistCount: storedWishlist.length,
      },
    };
  }

  // Merge mode: keep newer profile, merge diary by place_id, append missing wishlist entries
  const [existingProfile, existingDiary, existingWishlist] = await Promise.all([
    getLocalProfile(now),
    listDiaryEntries(nowMs),
    listWishlistEntries(nowMs),
  ]);

  const targetProfile: LocalProfile =
    Date.parse(profile.updated_at) >= Date.parse(existingProfile.updated_at)
      ? profile
      : existingProfile;
  await replaceLocalProfile(targetProfile);

  const diaryMap = new Map<string, DiaryEntry>(existingDiary.map((e) => [e.place_id, e]));
  for (const incoming of diary) {
    const current = diaryMap.get(incoming.place_id);
    const winner = current ? pickNewerDiaryEntry(current, incoming) : incoming;
    diaryMap.set(winner.place_id, winner);
  }
  const mergedDiary = await replaceDiaryEntries(Array.from(diaryMap.values()), nowMs);

  const wishlistMap = new Map<string, WishlistEntry>(
    existingWishlist.map((w) => [w.place_id, w])
  );
  let nextSortOrder =
    existingWishlist.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;

  for (const incoming of wishlist) {
    if (!wishlistMap.has(incoming.place_id)) {
      wishlistMap.set(incoming.place_id, {
        ...incoming,
        sort_order: nextSortOrder++,
      });
    }
  }
  const mergedWishlist = await replaceWishlistEntries(Array.from(wishlistMap.values()), nowMs);

  return {
    success: true,
    imported: {
      diaryCount: mergedDiary.length,
      wishlistCount: mergedWishlist.length,
    },
  };
}

export async function estimateLocalStorageUsage(
  nowMs: number = Date.now()
): Promise<LocalStorageUsageEstimate> {
  const [profile, diary, wishlist, mapCache] = await Promise.all([
    getLocalProfile(new Date(nowMs)),
    listDiaryEntries(),
    listWishlistEntries(),
    getMapCacheEntries({ nowMs, touchAccess: false }),
  ]);

  const profileBytes = measureUtf8Bytes(JSON.stringify(profile));
  const diaryBytes = measureUtf8Bytes(JSON.stringify(diary));
  const wishlistBytes = measureUtf8Bytes(JSON.stringify(wishlist));
  const mapCacheBytes = measureUtf8Bytes(JSON.stringify(mapCache));

  const win = typeof window !== "undefined" ? window : undefined;
  const browserPreferencesBytes = estimateWebStorageBytes(win?.localStorage);
  const browserSessionBytes = estimateWebStorageBytes(win?.sessionStorage);

  let navigatorQuota: LocalStorageUsageEstimate["navigatorQuota"];
  if (typeof navigator !== "undefined" && typeof navigator.storage?.estimate === "function") {
    try {
      const est = await navigator.storage.estimate();
      navigatorQuota = {
        usage: typeof est.usage === "number" ? est.usage : null,
        quota: typeof est.quota === "number" ? est.quota : null,
      };
    } catch {
      // ignore unsupported storage manager
    }
  }

  return {
    usingMemoryFallback: isUsingMemoryFallback(),
    totalBytes:
      profileBytes +
      diaryBytes +
      wishlistBytes +
      mapCacheBytes +
      browserPreferencesBytes +
      browserSessionBytes,
    stores: {
      profile: { bytes: profileBytes, count: 1 },
      diary: { bytes: diaryBytes, count: diary.length },
      wishlist: { bytes: wishlistBytes, count: wishlist.length },
      mapCache: { bytes: mapCacheBytes, count: mapCache.length },
    },
    browserPreferencesBytes,
    browserSessionBytes,
    ...(navigatorQuota ? { navigatorQuota } : {}),
  };
}

/**
 * Completely resets all local IndexedDB stores (profile, diary, wishlist, map cache)
 * and browser personal consents/session keys.
 */
export async function resetAllLocalData(): Promise<void> {
  await clearAllStores();
  clearLocalUserState();
}

export { upsertDiaryEntry, upsertWishlistEntry };
