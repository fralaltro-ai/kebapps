import { calculateReviewAverage } from "@/lib/ratingLabels";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_NICKNAME,
  DiaryEntry,
  DiaryEntryInput,
  DiaryEntryInputSchema,
  DiaryEntrySchema,
  GOOGLE_COORDS_TTL_MS,
  LOCAL_PROFILE_ID,
  LocalProfile,
  LocalProfilePatch,
  LocalProfilePatchSchema,
  LocalProfileSchema,
  MAP_CACHE_MAX_ENTRIES,
  MAP_CACHE_TTL_MS,
  MapCacheEntry,
  MapCacheEntrySchema,
  MapCacheShopInput,
  WishlistEntry,
  WishlistEntryInput,
  WishlistEntryInputSchema,
  WishlistEntrySchema,
} from "./schema";

export const LOCAL_DB_NAME = "kebapps_local_db";
export const LOCAL_DB_VERSION = 1;

export const STORE_NAMES = {
  PROFILE: "profile",
  DIARY: "diary",
  WISHLIST: "wishlist",
  MAP_CACHE: "map_cache",
} as const;

export type LocalStoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

interface StorageAdapter {
  readonly isMemoryFallback: boolean;
  get<T>(store: LocalStoreName, key: string): Promise<T | null>;
  getAll<T>(store: LocalStoreName): Promise<T[]>;
  put<T>(store: LocalStoreName, value: T): Promise<void>;
  putMany<T>(store: LocalStoreName, values: T[]): Promise<void>;
  remove(store: LocalStoreName, key: string): Promise<boolean>;
  removeMany(store: LocalStoreName, keys: string[]): Promise<number>;
  clear(store: LocalStoreName): Promise<void>;
  replaceStore<T>(store: LocalStoreName, values: T[]): Promise<void>;
}

const memoryBacking = new Map<LocalStoreName, Map<string, unknown>>([
  [STORE_NAMES.PROFILE, new Map()],
  [STORE_NAMES.DIARY, new Map()],
  [STORE_NAMES.WISHLIST, new Map()],
  [STORE_NAMES.MAP_CACHE, new Map()],
]);

function getKeyForStore(store: LocalStoreName, value: unknown): string {
  const rec = value as Record<string, unknown>;
  if (store === STORE_NAMES.PROFILE) {
    return String(rec.id);
  }
  return String(rec.place_id);
}

function cloneRecord<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryStorageAdapter implements StorageAdapter {
  readonly isMemoryFallback = true;

  async get<T>(store: LocalStoreName, key: string): Promise<T | null> {
    const val = memoryBacking.get(store)?.get(key);
    return val === undefined ? null : cloneRecord(val as T);
  }

  async getAll<T>(store: LocalStoreName): Promise<T[]> {
    const map = memoryBacking.get(store);
    if (!map) return [];
    return Array.from(map.values()).map((item) => cloneRecord(item as T));
  }

  async put<T>(store: LocalStoreName, value: T): Promise<void> {
    const key = getKeyForStore(store, value);
    memoryBacking.get(store)?.set(key, cloneRecord(value));
  }

  async putMany<T>(store: LocalStoreName, values: T[]): Promise<void> {
    const map = memoryBacking.get(store);
    if (!map) return;
    for (const value of values) {
      map.set(getKeyForStore(store, value), cloneRecord(value));
    }
  }

  async remove(store: LocalStoreName, key: string): Promise<boolean> {
    return memoryBacking.get(store)?.delete(key) ?? false;
  }

  async removeMany(store: LocalStoreName, keys: string[]): Promise<number> {
    const map = memoryBacking.get(store);
    if (!map) return 0;
    let count = 0;
    for (const key of keys) {
      if (map.delete(key)) count++;
    }
    return count;
  }

  async clear(store: LocalStoreName): Promise<void> {
    memoryBacking.get(store)?.clear();
  }

  async replaceStore<T>(store: LocalStoreName, values: T[]): Promise<void> {
    const map = memoryBacking.get(store);
    if (!map) return;
    map.clear();
    for (const value of values) {
      map.set(getKeyForStore(store, value), cloneRecord(value));
    }
  }
}

const memoryFallbackAdapter = new MemoryStorageAdapter();

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request error"));
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction error"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

class IndexedDbStorageAdapter implements StorageAdapter {
  readonly isMemoryFallback = false;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private idbUnavailable = false;

  constructor(private readonly factory: IDBFactory) {}

  private async openDb(): Promise<IDBDatabase> {
    if (this.idbUnavailable) {
      throw new Error("IndexedDB unavailable");
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = this.factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAMES.PROFILE)) {
            db.createObjectStore(STORE_NAMES.PROFILE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_NAMES.DIARY)) {
            db.createObjectStore(STORE_NAMES.DIARY, { keyPath: "place_id" });
          }
          if (!db.objectStoreNames.contains(STORE_NAMES.WISHLIST)) {
            db.createObjectStore(STORE_NAMES.WISHLIST, { keyPath: "place_id" });
          }
          if (!db.objectStoreNames.contains(STORE_NAMES.MAP_CACHE)) {
            db.createObjectStore(STORE_NAMES.MAP_CACHE, { keyPath: "place_id" });
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = () => {
          this.dbPromise = null;
          this.idbUnavailable = true;
          reject(request.error ?? new Error("Failed to open IndexedDB"));
        };

        request.onblocked = () => {
          this.dbPromise = null;
          reject(new Error("IndexedDB open blocked"));
        };
      } catch (err) {
        this.dbPromise = null;
        this.idbUnavailable = true;
        reject(err);
      }
    });

    return this.dbPromise;
  }

  private async withFallback<T>(
    idbOp: (db: IDBDatabase) => Promise<T>,
    fallbackOp: () => Promise<T>
  ): Promise<T> {
    try {
      const db = await this.openDb();
      return await idbOp(db);
    } catch {
      this.idbUnavailable = true;
      this.dbPromise = null;
      return fallbackOp();
    }
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      db.close();
    } catch {
      // ignore close errors
    } finally {
      this.dbPromise = null;
    }
  }

  async get<T>(store: LocalStoreName, key: string): Promise<T | null> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readonly");
        const result = await requestToPromise<T | undefined>(tx.objectStore(store).get(key));
        await transactionToPromise(tx);
        return result === undefined ? null : result;
      },
      () => memoryFallbackAdapter.get<T>(store, key)
    );
  }

  async getAll<T>(store: LocalStoreName): Promise<T[]> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readonly");
        const result = await requestToPromise<T[]>(tx.objectStore(store).getAll());
        await transactionToPromise(tx);
        return result ?? [];
      },
      () => memoryFallbackAdapter.getAll<T>(store)
    );
  }

  async put<T>(store: LocalStoreName, value: T): Promise<void> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        await transactionToPromise(tx);
      },
      () => memoryFallbackAdapter.put(store, value)
    );
  }

  async putMany<T>(store: LocalStoreName, values: T[]): Promise<void> {
    if (values.length === 0) return;
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        for (const value of values) {
          objectStore.put(value);
        }
        await transactionToPromise(tx);
      },
      () => memoryFallbackAdapter.putMany(store, values)
    );
  }

  async remove(store: LocalStoreName, key: string): Promise<boolean> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        const existing = await requestToPromise<unknown>(objectStore.get(key));
        if (existing === undefined) {
          await transactionToPromise(tx);
          return false;
        }
        objectStore.delete(key);
        await transactionToPromise(tx);
        return true;
      },
      () => memoryFallbackAdapter.remove(store, key)
    );
  }

  async removeMany(store: LocalStoreName, keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        let removed = 0;
        for (const key of keys) {
          const existing = await requestToPromise<unknown>(objectStore.get(key));
          if (existing !== undefined) {
            objectStore.delete(key);
            removed++;
          }
        }
        await transactionToPromise(tx);
        return removed;
      },
      () => memoryFallbackAdapter.removeMany(store, keys)
    );
  }

  async clear(store: LocalStoreName): Promise<void> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        await transactionToPromise(tx);
      },
      () => memoryFallbackAdapter.clear(store)
    );
  }

  async replaceStore<T>(store: LocalStoreName, values: T[]): Promise<void> {
    return this.withFallback(
      async (db) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        objectStore.clear();
        for (const value of values) {
          objectStore.put(value);
        }
        await transactionToPromise(tx);
      },
      () => memoryFallbackAdapter.replaceStore(store, values)
    );
  }
}

let activeIdbAdapter: IndexedDbStorageAdapter | null = null;
let cachedIdbFactoryRef: IDBFactory | null = null;

function getStorageAdapter(): StorageAdapter {
  const idbFactory =
    typeof globalThis !== "undefined" && "indexedDB" in globalThis
      ? (globalThis.indexedDB as IDBFactory | undefined)
      : undefined;

  if (!idbFactory || typeof idbFactory.open !== "function") {
    return memoryFallbackAdapter;
  }

  if (!activeIdbAdapter || cachedIdbFactoryRef !== idbFactory) {
    activeIdbAdapter = new IndexedDbStorageAdapter(idbFactory);
    cachedIdbFactoryRef = idbFactory;
  }

  return activeIdbAdapter;
}

export function isUsingMemoryFallback(): boolean {
  const adapter = getStorageAdapter();
  return adapter.isMemoryFallback || (activeIdbAdapter === null && adapter === memoryFallbackAdapter);
}

export async function resetLocalDbAdapterForTests(): Promise<void> {
  if (activeIdbAdapter) {
    await activeIdbAdapter.close();
  }
  activeIdbAdapter = null;
  cachedIdbFactoryRef = null;
  for (const map of memoryBacking.values()) {
    map.clear();
  }
}

export async function clearAllStores(): Promise<void> {
  const adapter = getStorageAdapter();
  await Promise.all([
    adapter.clear(STORE_NAMES.PROFILE),
    adapter.clear(STORE_NAMES.DIARY),
    adapter.clear(STORE_NAMES.WISHLIST),
    adapter.clear(STORE_NAMES.MAP_CACHE),
  ]);
  for (const map of memoryBacking.values()) {
    map.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* Profile CRUD                                                                */
/* -------------------------------------------------------------------------- */

export function buildDefaultProfile(now: Date = new Date()): LocalProfile {
  const iso = now.toISOString();
  return LocalProfileSchema.parse({
    id: LOCAL_PROFILE_ID,
    nickname: DEFAULT_NICKNAME,
    avatar_id: DEFAULT_AVATAR_ID,
    created_at: iso,
    updated_at: iso,
  });
}

export async function getLocalProfile(now: Date = new Date()): Promise<LocalProfile> {
  const adapter = getStorageAdapter();
  const raw = await adapter.get<unknown>(STORE_NAMES.PROFILE, LOCAL_PROFILE_ID);
  if (raw) {
    const parsed = LocalProfileSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return buildDefaultProfile(now);
}

export async function saveLocalProfile(
  patch: LocalProfilePatch,
  now: Date = new Date()
): Promise<LocalProfile> {
  const validPatch = LocalProfilePatchSchema.parse(patch);
  const current = await getLocalProfile(now);
  const next = LocalProfileSchema.parse({
    ...current,
    ...(validPatch.nickname !== undefined ? { nickname: validPatch.nickname } : {}),
    ...(validPatch.avatar_id !== undefined ? { avatar_id: validPatch.avatar_id } : {}),
    updated_at: now.toISOString(),
  });
  await getStorageAdapter().put(STORE_NAMES.PROFILE, next);
  return next;
}

export async function replaceLocalProfile(profile: LocalProfile): Promise<LocalProfile> {
  const valid = LocalProfileSchema.parse(profile);
  await getStorageAdapter().replaceStore(STORE_NAMES.PROFILE, [valid]);
  return valid;
}

/* -------------------------------------------------------------------------- */
/* Diary CRUD (Personal Kebab Reviews)                                         */
/* -------------------------------------------------------------------------- */

function stripExpiredCoords<
  T extends { latitude: number | null; longitude: number | null; coords_expires_at: number | null }
>(entry: T, nowMs: number): { entry: T; expired: boolean } {
  if (entry.coords_expires_at !== null && entry.coords_expires_at <= nowMs) {
    return {
      entry: { ...entry, latitude: null, longitude: null, coords_expires_at: null },
      expired: true,
    };
  }
  return { entry, expired: false };
}

function clampCoordsExpiry(
  expiry: number | null | undefined,
  latitude: number | null,
  longitude: number | null,
  nowMs: number
): number | null {
  if (latitude === null || longitude === null || expiry === null || expiry === undefined) {
    return null;
  }
  return Math.min(expiry, nowMs + GOOGLE_COORDS_TTL_MS);
}

function sortDiaryEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    const timeDiff = Date.parse(b.visited_at) - Date.parse(a.visited_at);
    if (timeDiff !== 0) return timeDiff;
    return a.place_id.localeCompare(b.place_id);
  });
}

export async function listDiaryEntries(nowMs: number = Date.now()): Promise<DiaryEntry[]> {
  const adapter = getStorageAdapter();
  const rawList = await adapter.getAll<unknown>(STORE_NAMES.DIARY);
  const valid: DiaryEntry[] = [];
  const expiredUpdates: DiaryEntry[] = [];
  for (const item of rawList) {
    const parsed = DiaryEntrySchema.safeParse(item);
    if (parsed.success) {
      const { entry, expired } = stripExpiredCoords(parsed.data, nowMs);
      valid.push(entry);
      if (expired) expiredUpdates.push(entry);
    }
  }
  if (expiredUpdates.length > 0) {
    await adapter.putMany(STORE_NAMES.DIARY, expiredUpdates);
  }
  return sortDiaryEntries(valid);
}

export async function getDiaryEntry(
  placeId: string,
  nowMs: number = Date.now()
): Promise<DiaryEntry | null> {
  const adapter = getStorageAdapter();
  const raw = await adapter.get<unknown>(STORE_NAMES.DIARY, placeId);
  if (!raw) return null;
  const parsed = DiaryEntrySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { entry, expired } = stripExpiredCoords(parsed.data, nowMs);
  if (expired) {
    await adapter.put(STORE_NAMES.DIARY, entry);
  }
  return entry;
}

export async function upsertDiaryEntry(
  input: DiaryEntryInput,
  now: Date = new Date()
): Promise<DiaryEntry> {
  const validInput = DiaryEntryInputSchema.parse(input);
  const adapter = getStorageAdapter();
  const nowMs = now.getTime();
  const existing = await getDiaryEntry(validInput.place_id, nowMs);
  const nowIso = now.toISOString();

  const computedOverall =
    validInput.score_overall ??
    Number(
      calculateReviewAverage({
        score_meat: validInput.score_meat,
        score_bread: validInput.score_bread,
        score_sauces: validInput.score_sauces,
        score_value: validInput.score_value,
        score_location: validInput.score_location ?? null,
      }).toFixed(2)
    );

  const nextLat = validInput.latitude !== undefined ? validInput.latitude : (existing?.latitude ?? null);
  const nextLng = validInput.longitude !== undefined ? validInput.longitude : (existing?.longitude ?? null);
  const rawExpiry =
    validInput.coords_expires_at !== undefined
      ? validInput.coords_expires_at
      : (existing?.coords_expires_at ?? null);

  const entry = DiaryEntrySchema.parse({
    id: validInput.id ?? existing?.id ?? `diary_${validInput.place_id}`,
    place_id: validInput.place_id,
    shop_label: validInput.shop_label,
    city: validInput.city !== undefined ? validInput.city : (existing?.city ?? null),
    country: validInput.country !== undefined ? validInput.country : (existing?.country ?? null),
    latitude: nextLat,
    longitude: nextLng,
    coords_expires_at: clampCoordsExpiry(rawExpiry, nextLat, nextLng, nowMs),
    score_overall: computedOverall,
    score_meat: validInput.score_meat,
    score_bread: validInput.score_bread,
    score_sauces: validInput.score_sauces,
    score_value: validInput.score_value,
    score_location:
      validInput.score_location !== undefined
        ? validInput.score_location
        : (existing?.score_location ?? null),
    note: validInput.note ?? existing?.note ?? "",
    visited_at: validInput.visited_at ?? existing?.visited_at ?? nowIso,
    created_at: existing?.created_at ?? nowIso,
    updated_at: nowIso,
  });

  await adapter.put(STORE_NAMES.DIARY, entry);
  return entry;
}

export async function deleteDiaryEntry(placeId: string): Promise<boolean> {
  return getStorageAdapter().remove(STORE_NAMES.DIARY, placeId);
}

export async function clearDiaryEntries(): Promise<void> {
  await getStorageAdapter().clear(STORE_NAMES.DIARY);
}

export async function replaceDiaryEntries(
  entries: DiaryEntry[],
  nowMs: number = Date.now()
): Promise<DiaryEntry[]> {
  const deduped = new Map<string, DiaryEntry>();
  for (const item of entries) {
    const parsed = DiaryEntrySchema.parse(item);
    const { entry } = stripExpiredCoords(parsed, nowMs);
    deduped.set(entry.place_id, {
      ...entry,
      coords_expires_at: clampCoordsExpiry(
        entry.coords_expires_at,
        entry.latitude,
        entry.longitude,
        nowMs
      ),
    });
  }
  const normalized = sortDiaryEntries(Array.from(deduped.values()));
  await getStorageAdapter().replaceStore(STORE_NAMES.DIARY, normalized);
  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Wishlist CRUD                                                               */
/* -------------------------------------------------------------------------- */

function sortWishlistEntries(entries: WishlistEntry[]): WishlistEntry[] {
  return [...entries].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const timeDiff = Date.parse(b.added_at) - Date.parse(a.added_at);
    if (timeDiff !== 0) return timeDiff;
    return a.place_id.localeCompare(b.place_id);
  });
}

export async function listWishlistEntries(nowMs: number = Date.now()): Promise<WishlistEntry[]> {
  const adapter = getStorageAdapter();
  const rawList = await adapter.getAll<unknown>(STORE_NAMES.WISHLIST);
  const valid: WishlistEntry[] = [];
  const expiredUpdates: WishlistEntry[] = [];
  for (const item of rawList) {
    const parsed = WishlistEntrySchema.safeParse(item);
    if (parsed.success) {
      const { entry, expired } = stripExpiredCoords(parsed.data, nowMs);
      valid.push(entry);
      if (expired) expiredUpdates.push(entry);
    }
  }
  if (expiredUpdates.length > 0) {
    await adapter.putMany(STORE_NAMES.WISHLIST, expiredUpdates);
  }
  return sortWishlistEntries(valid);
}

export async function getWishlistEntry(
  placeId: string,
  nowMs: number = Date.now()
): Promise<WishlistEntry | null> {
  const adapter = getStorageAdapter();
  const raw = await adapter.get<unknown>(STORE_NAMES.WISHLIST, placeId);
  if (!raw) return null;
  const parsed = WishlistEntrySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { entry, expired } = stripExpiredCoords(parsed.data, nowMs);
  if (expired) {
    await adapter.put(STORE_NAMES.WISHLIST, entry);
  }
  return entry;
}

export async function upsertWishlistEntry(
  input: WishlistEntryInput,
  now: Date = new Date()
): Promise<WishlistEntry> {
  const validInput = WishlistEntryInputSchema.parse(input);
  const adapter = getStorageAdapter();
  const nowMs = now.getTime();
  const existing = await getWishlistEntry(validInput.place_id, nowMs);

  let nextSortOrder = validInput.sort_order ?? existing?.sort_order;
  if (nextSortOrder === undefined) {
    const all = await listWishlistEntries(nowMs);
    nextSortOrder = all.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;
  }

  const nextLat = validInput.latitude !== undefined ? validInput.latitude : (existing?.latitude ?? null);
  const nextLng = validInput.longitude !== undefined ? validInput.longitude : (existing?.longitude ?? null);
  const rawExpiry =
    validInput.coords_expires_at !== undefined
      ? validInput.coords_expires_at
      : (existing?.coords_expires_at ?? null);

  const entry = WishlistEntrySchema.parse({
    id: validInput.id ?? existing?.id ?? `wish_${validInput.place_id}`,
    place_id: validInput.place_id,
    shop_label: validInput.shop_label,
    note: validInput.note ?? existing?.note ?? "",
    latitude: nextLat,
    longitude: nextLng,
    coords_expires_at: clampCoordsExpiry(rawExpiry, nextLat, nextLng, nowMs),
    sort_order: nextSortOrder,
    added_at: validInput.added_at ?? existing?.added_at ?? now.toISOString(),
  });

  await adapter.put(STORE_NAMES.WISHLIST, entry);
  return entry;
}

export async function reorderWishlistEntries(orderedPlaceIds: string[]): Promise<WishlistEntry[]> {
  const current = await listWishlistEntries();
  const byPlaceId = new Map(current.map((item) => [item.place_id, item]));
  const updated: WishlistEntry[] = [];
  const seen = new Set<string>();

  let order = 0;
  for (const placeId of orderedPlaceIds) {
    const entry = byPlaceId.get(placeId);
    if (!entry || seen.has(placeId)) continue;
    seen.add(placeId);
    updated.push({ ...entry, sort_order: order++ });
  }

  for (const entry of current) {
    if (!seen.has(entry.place_id)) {
      updated.push({ ...entry, sort_order: order++ });
    }
  }

  await getStorageAdapter().replaceStore(STORE_NAMES.WISHLIST, updated);
  return sortWishlistEntries(updated);
}

export async function deleteWishlistEntry(placeId: string): Promise<boolean> {
  return getStorageAdapter().remove(STORE_NAMES.WISHLIST, placeId);
}

export async function clearWishlistEntries(): Promise<void> {
  await getStorageAdapter().clear(STORE_NAMES.WISHLIST);
}

export async function replaceWishlistEntries(
  entries: WishlistEntry[],
  nowMs: number = Date.now()
): Promise<WishlistEntry[]> {
  const deduped = new Map<string, WishlistEntry>();
  for (const item of entries) {
    const parsed = WishlistEntrySchema.parse(item);
    const { entry } = stripExpiredCoords(parsed, nowMs);
    deduped.set(entry.place_id, {
      ...entry,
      coords_expires_at: clampCoordsExpiry(
        entry.coords_expires_at,
        entry.latitude,
        entry.longitude,
        nowMs
      ),
    });
  }
  const normalized = sortWishlistEntries(Array.from(deduped.values()));
  await getStorageAdapter().replaceStore(STORE_NAMES.WISHLIST, normalized);
  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Ephemeral Map Cache (TTL <= 24h + LRU Eviction)                             */
/* -------------------------------------------------------------------------- */

function sanitizeMapCacheShopInput(
  shop: MapCacheShopInput,
  nowMs: number,
  ttlMs: number
): MapCacheEntry {
  const boundedTtl = Math.max(1, Math.min(ttlMs, MAP_CACHE_TTL_MS));
  return MapCacheEntrySchema.parse({
    place_id: shop.place_id,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    cached_at: nowMs,
    expires_at: nowMs + boundedTtl,
    last_accessed_at: nowMs,
  });
}

async function readValidAndPurgeExpired(nowMs: number): Promise<MapCacheEntry[]> {
  const adapter = getStorageAdapter();
  const rawList = await adapter.getAll<unknown>(STORE_NAMES.MAP_CACHE);
  const valid: MapCacheEntry[] = [];
  const keysToRemove: string[] = [];

  for (const raw of rawList) {
    const parsed = MapCacheEntrySchema.safeParse(raw);
    if (!parsed.success) {
      const maybeKey = (raw as { place_id?: unknown })?.place_id;
      if (typeof maybeKey === "string") {
        keysToRemove.push(maybeKey);
      }
      continue;
    }
    if (parsed.data.expires_at <= nowMs) {
      keysToRemove.push(parsed.data.place_id);
      continue;
    }
    valid.push(parsed.data);
  }

  if (keysToRemove.length > 0) {
    await adapter.removeMany(STORE_NAMES.MAP_CACHE, keysToRemove);
  }

  return valid;
}

export async function purgeExpiredMapCache(nowMs: number = Date.now()): Promise<number> {
  const adapter = getStorageAdapter();
  const rawList = await adapter.getAll<unknown>(STORE_NAMES.MAP_CACHE);
  const expiredKeys: string[] = [];

  for (const raw of rawList) {
    const parsed = MapCacheEntrySchema.safeParse(raw);
    if (!parsed.success) {
      const maybeKey = (raw as { place_id?: unknown })?.place_id;
      if (typeof maybeKey === "string") {
        expiredKeys.push(maybeKey);
      }
      continue;
    }
    if (parsed.data.expires_at <= nowMs) {
      expiredKeys.push(parsed.data.place_id);
    }
  }

  if (expiredKeys.length === 0) return 0;
  return adapter.removeMany(STORE_NAMES.MAP_CACHE, expiredKeys);
}

export async function upsertMapCacheEntries(
  shops: MapCacheShopInput[],
  options: { nowMs?: number; ttlMs?: number; maxEntries?: number } = {}
): Promise<MapCacheEntry[]> {
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? MAP_CACHE_TTL_MS;
  const maxEntries = Math.max(1, options.maxEntries ?? MAP_CACHE_MAX_ENTRIES);
  const adapter = getStorageAdapter();

  const existingValid = await readValidAndPurgeExpired(nowMs);
  const byPlaceId = new Map<string, MapCacheEntry>(
    existingValid.map((entry) => [entry.place_id, entry])
  );

  for (let i = 0; i < shops.length; i++) {
    // Preserve relative insertion recency within a batch when nowMs is constant
    const accessTs = nowMs + i;
    const sanitized = sanitizeMapCacheShopInput(shops[i], nowMs, ttlMs);
    const withRecency: MapCacheEntry = {
      ...sanitized,
      last_accessed_at: accessTs,
    };
    byPlaceId.set(withRecency.place_id, withRecency);
  }

  const allEntries = Array.from(byPlaceId.values());
  if (allEntries.length > maxEntries) {
    allEntries.sort((a, b) => {
      if (a.last_accessed_at !== b.last_accessed_at) {
        return a.last_accessed_at - b.last_accessed_at;
      }
      if (a.cached_at !== b.cached_at) {
        return a.cached_at - b.cached_at;
      }
      return a.place_id.localeCompare(b.place_id);
    });
    const evictCount = allEntries.length - maxEntries;
    const keysToEvict = allEntries.slice(0, evictCount).map((e) => e.place_id);
    await adapter.removeMany(STORE_NAMES.MAP_CACHE, keysToEvict);
    const kept = allEntries.slice(evictCount);
    await adapter.putMany(STORE_NAMES.MAP_CACHE, kept);
    return kept.sort((a, b) => b.last_accessed_at - a.last_accessed_at);
  }

  const nextList = Array.from(byPlaceId.values());
  await adapter.putMany(STORE_NAMES.MAP_CACHE, nextList);
  return nextList.sort((a, b) => b.last_accessed_at - a.last_accessed_at);
}

export async function getMapCacheEntry(
  placeId: string,
  options: { nowMs?: number } = {}
): Promise<MapCacheEntry | null> {
  const nowMs = options.nowMs ?? Date.now();
  const adapter = getStorageAdapter();
  const raw = await adapter.get<unknown>(STORE_NAMES.MAP_CACHE, placeId);
  if (!raw) return null;

  const parsed = MapCacheEntrySchema.safeParse(raw);
  if (!parsed.success || parsed.data.expires_at <= nowMs) {
    await adapter.remove(STORE_NAMES.MAP_CACHE, placeId);
    return null;
  }

  const touched: MapCacheEntry = {
    ...parsed.data,
    last_accessed_at: Math.max(parsed.data.last_accessed_at, nowMs),
  };
  await adapter.put(STORE_NAMES.MAP_CACHE, touched);
  return touched;
}

export async function getMapCacheEntries(
  options: { nowMs?: number; touchAccess?: boolean } = {}
): Promise<MapCacheEntry[]> {
  const nowMs = options.nowMs ?? Date.now();
  const touchAccess = options.touchAccess ?? false;
  const valid = await readValidAndPurgeExpired(nowMs);

  if (touchAccess && valid.length > 0) {
    const touched = valid.map((entry) => ({
      ...entry,
      last_accessed_at: Math.max(entry.last_accessed_at, nowMs),
    }));
    await getStorageAdapter().putMany(STORE_NAMES.MAP_CACHE, touched);
    return touched.sort((a, b) => b.last_accessed_at - a.last_accessed_at);
  }

  return valid.sort((a, b) => b.last_accessed_at - a.last_accessed_at);
}

export async function clearMapCache(): Promise<void> {
  await getStorageAdapter().clear(STORE_NAMES.MAP_CACHE);
}
