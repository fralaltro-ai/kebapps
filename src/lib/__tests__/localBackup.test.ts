import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateLocalStorageUsage,
  exportBackupData,
  formatBytes,
  importBackupData,
  parseAndValidateBackupJson,
  resetAllLocalData,
  serializeBackupJson,
} from "@/lib/local-storage/backup";
import {
  clearAllStores,
  getLocalProfile,
  getMapCacheEntries,
  listDiaryEntries,
  listWishlistEntries,
  resetLocalDbAdapterForTests,
  saveLocalProfile,
  upsertDiaryEntry,
  upsertMapCacheEntries,
  upsertWishlistEntry,
} from "@/lib/local-storage/db";
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  DEFAULT_NICKNAME,
  GOOGLE_COORDS_TTL_MS,
  MAX_BACKUP_BYTES,
} from "@/lib/local-storage/schema";
import { GPS_CONSENT_KEY } from "@/hooks/useGpsConsent";
import { MAPS_CONSENT_KEY } from "@/hooks/useMapConsent";
import { PWA_KEYS, SESSION_COUNTED_KEY } from "@/lib/pwa-utils";

describe("Local Backup, Storage Estimate & Full Reset", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    await resetLocalDbAdapterForTests();
    await clearAllStores();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetLocalDbAdapterForTests();
  });

  it("exports versioned JSON with profile, diary, wishlist, excludes map_cache, and strips Google-sourced coordinates", async () => {
    const now = new Date("2026-11-15T15:00:00.000Z");
    await saveLocalProfile({ nickname: "Kebab Explorer", avatar_id: "cavaliere_falafel" }, now);
    await upsertDiaryEntry({
      place_id: "place_exp_1",
      shop_label: "Bosphorus Grill",
      city: "Torino",
      country: "Italy",
      latitude: 45.07,
      longitude: 7.68,
      coords_expires_at: now.getTime() + GOOGLE_COORDS_TTL_MS,
      score_meat: 5,
      score_bread: 5,
      score_sauces: 4,
      score_value: 5,
      score_location: 4,
      note: "Ottimo pane caldo.",
    }, now);
    await upsertWishlistEntry({
      place_id: "place_wish_1",
      shop_label: "Ankara Doner",
      latitude: 45.08,
      longitude: 7.69,
      coords_expires_at: now.getTime() + GOOGLE_COORDS_TTL_MS,
      note: "Andare venerdì",
    }, now);
    await upsertMapCacheEntries([
      {
        place_id: "place_cache_only",
        latitude: 45.07,
        longitude: 7.68,
      },
    ]);

    const bundle = await exportBackupData(now);
    expect(bundle.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(bundle.app).toBe(BACKUP_APP_ID);
    expect(bundle.data.profile.nickname).toBe("Kebab Explorer");
    expect(bundle.data.diary).toHaveLength(1);
    expect(bundle.data.diary[0].latitude).toBeNull();
    expect(bundle.data.diary[0].longitude).toBeNull();
    expect(bundle.data.diary[0].coords_expires_at).toBeNull();
    expect(bundle.data.diary[0].place_id).toBe("place_exp_1");
    expect(bundle.data.wishlist).toHaveLength(1);
    expect(bundle.data.wishlist[0].latitude).toBeNull();
    expect(bundle.data.wishlist[0].longitude).toBeNull();
    expect("map_cache" in bundle.data).toBe(false);

    const json = await serializeBackupJson(now);
    expect(json).not.toContain("place_cache_only");
  });

  it("imports valid backup in replace mode and merge mode", async () => {
    await saveLocalProfile({
      nickname: "Vecchio Nome",
      avatar_id: "maestro_spiedo",
    }, new Date("2026-11-10T10:00:00.000Z"));

    await upsertDiaryEntry({
      place_id: "place_shared",
      shop_label: "Locale Condiviso",
      score_meat: 3,
      score_bread: 3,
      score_sauces: 3,
      score_value: 3,
      note: "Vecchia nota",
    }, new Date("2026-11-10T10:00:00.000Z"));

    const incomingJson = JSON.stringify({
      schema_version: 1,
      app: "kebapps-local",
      exported_at: "2026-11-15T12:00:00.000Z",
      data: {
        profile: {
          id: "local_user",
          nickname: "Nuovo Nome",
          avatar_id: "ninja_cipolla",
          created_at: "2026-11-01T10:00:00.000Z",
          updated_at: "2026-11-15T12:00:00.000Z",
        },
        diary: [
          {
            id: "diary_place_shared",
            place_id: "place_shared",
            shop_label: "Locale Condiviso",
            city: "Roma",
            country: "Italy",
            latitude: null,
            longitude: null,
            score_overall: 5,
            score_meat: 5,
            score_bread: 5,
            score_sauces: 5,
            score_value: 5,
            score_location: 5,
            note: "Nota aggiornata dal backup",
            visited_at: "2026-11-14T20:00:00.000Z",
            created_at: "2026-11-14T20:00:00.000Z",
            updated_at: "2026-11-15T11:00:00.000Z",
          },
          {
            id: "diary_place_new",
            place_id: "place_new",
            shop_label: "Nuovo Kebab",
            city: "Bologna",
            country: "Italy",
            latitude: 44.49,
            longitude: 11.34,
            score_overall: 4,
            score_meat: 4,
            score_bread: 4,
            score_sauces: 4,
            score_value: 4,
            score_location: null,
            note: "",
            visited_at: "2026-11-13T18:00:00.000Z",
            created_at: "2026-11-13T18:00:00.000Z",
            updated_at: "2026-11-13T18:00:00.000Z",
          },
        ],
        wishlist: [
          {
            id: "wish_place_w1",
            place_id: "place_w1",
            shop_label: "Da Provare",
            note: "Pita fatta in casa",
            latitude: null,
            longitude: null,
            sort_order: 0,
            added_at: "2026-11-12T10:00:00.000Z",
          },
        ],
      },
    });

    // Merge mode keeps newer updated_at entries and appends missing items
    await upsertWishlistEntry({
      place_id: "place_existing_w",
      shop_label: "Già in Wishlist",
    });

    const mergeResult = await importBackupData(incomingJson, { mode: "merge" });
    expect(mergeResult.success).toBe(true);
    expect(mergeResult.imported).toEqual({ diaryCount: 2, wishlistCount: 2 });
    expect((await getLocalProfile()).nickname).toBe("Nuovo Nome");
    expect((await listDiaryEntries()).find((d) => d.place_id === "place_shared")?.note).toBe(
      "Nota aggiornata dal backup"
    );

    // Replace mode overwrites collections cleanly
    const replaceResult = await importBackupData(incomingJson, { mode: "replace" });
    expect(replaceResult.success).toBe(true);
    expect(replaceResult.imported).toEqual({ diaryCount: 2, wishlistCount: 1 });
    expect(await listWishlistEntries()).toHaveLength(1);
  });

  it("rejects malformed, wrong-version, oversized, or photo/google-polluted backups without mutating state", async () => {
    await saveLocalProfile({ nickname: "Intact User", avatar_id: "signore_salsa" });

    expect(parseAndValidateBackupJson("").success).toBe(false);
    expect(parseAndValidateBackupJson("{not-valid-json").success).toBe(false);
    expect(parseAndValidateBackupJson("x".repeat(MAX_BACKUP_BYTES + 10)).success).toBe(false);

    const wrongVersion = JSON.stringify({
      schema_version: 99,
      app: "kebapps-local",
      exported_at: "2026-11-15T12:00:00.000Z",
      data: {
        profile: {
          id: "local_user",
          nickname: "Hack",
          avatar_id: "maestro_spiedo",
          created_at: "2026-11-15T12:00:00.000Z",
          updated_at: "2026-11-15T12:00:00.000Z",
        },
        diary: [],
        wishlist: [],
      },
    });
    const wrongVerRes = await importBackupData(wrongVersion);
    expect(wrongVerRes.success).toBe(false);
    expect(wrongVerRes.issues?.length).toBeGreaterThan(0);

    // Reject disallowed Google `types` or `photos` inside diary entry
    const pollutedDiary = JSON.stringify({
      schema_version: 1,
      app: "kebapps-local",
      exported_at: "2026-11-15T12:00:00.000Z",
      data: {
        profile: {
          id: "local_user",
          nickname: "Hack",
          avatar_id: "maestro_spiedo",
          created_at: "2026-11-15T12:00:00.000Z",
          updated_at: "2026-11-15T12:00:00.000Z",
        },
        diary: [
          {
            id: "d1",
            place_id: "place_1",
            shop_label: "Shop",
            score_overall: 4,
            score_meat: 4,
            score_bread: 4,
            score_sauces: 4,
            score_value: 4,
            score_location: null,
            note: "",
            visited_at: "2026-11-15T12:00:00.000Z",
            created_at: "2026-11-15T12:00:00.000Z",
            updated_at: "2026-11-15T12:00:00.000Z",
            types: ["restaurant"],
          },
        ],
        wishlist: [],
      },
    });
    const pollutedRes = await importBackupData(pollutedDiary);
    expect(pollutedRes.success).toBe(false);

    // Original profile remained untouched
    expect((await getLocalProfile()).nickname).toBe("Intact User");
  });

  it("rejects prototype-polluting place_id values and strips expired or over-clamped Google coords on import", async () => {
    const t0 = new Date("2026-11-18T12:00:00.000Z");
    const protoJson = JSON.stringify({
      schema_version: 1,
      app: "kebapps-local",
      exported_at: t0.toISOString(),
      data: {
        profile: {
          id: "local_user",
          nickname: "Tester",
          avatar_id: "maestro_spiedo",
          created_at: t0.toISOString(),
          updated_at: t0.toISOString(),
        },
        diary: [
          {
            id: "d_proto",
            place_id: "__proto__",
            shop_label: "Bad",
            score_overall: 4,
            score_meat: 4,
            score_bread: 4,
            score_sauces: 4,
            score_value: 4,
            score_location: null,
            note: "",
            visited_at: t0.toISOString(),
            created_at: t0.toISOString(),
            updated_at: t0.toISOString(),
          },
        ],
        wishlist: [],
      },
    });
    expect(parseAndValidateBackupJson(protoJson).success).toBe(false);

    const ttlImportJson = JSON.stringify({
      schema_version: 1,
      app: "kebapps-local",
      exported_at: t0.toISOString(),
      data: {
        profile: {
          id: "local_user",
          nickname: "Tester",
          avatar_id: "maestro_spiedo",
          created_at: t0.toISOString(),
          updated_at: t0.toISOString(),
        },
        diary: [
          {
            id: "d_expired",
            place_id: "place_expired_coords",
            shop_label: "Expired Coords Shop",
            latitude: 45.46,
            longitude: 9.19,
            coords_expires_at: t0.getTime() - 1000,
            score_overall: 4,
            score_meat: 4,
            score_bread: 4,
            score_sauces: 4,
            score_value: 4,
            score_location: null,
            note: "",
            visited_at: t0.toISOString(),
            created_at: t0.toISOString(),
            updated_at: t0.toISOString(),
          },
        ],
        wishlist: [
          {
            id: "w_clamped",
            place_id: "place_over_ttl",
            shop_label: "Clamped Coords Shop",
            note: "",
            latitude: 41.9,
            longitude: 12.5,
            coords_expires_at: t0.getTime() + GOOGLE_COORDS_TTL_MS * 10,
            sort_order: 0,
            added_at: t0.toISOString(),
          },
        ],
      },
    });

    const res = await importBackupData(ttlImportJson, { mode: "replace", now: t0 });
    expect(res.success).toBe(true);

    const diary = await listDiaryEntries(t0.getTime());
    expect(diary[0].latitude).toBeNull();
    expect(diary[0].longitude).toBeNull();
    expect(diary[0].coords_expires_at).toBeNull();

    const wishlist = await listWishlistEntries(t0.getTime());
    expect(wishlist[0].coords_expires_at).toBe(t0.getTime() + GOOGLE_COORDS_TTL_MS);
  });

  it("estimates occupied space and wipes all stores + browser consents + PWA keys on resetAllLocalData", async () => {
    window.localStorage.setItem(GPS_CONSENT_KEY, "granted");
    window.localStorage.setItem(MAPS_CONSENT_KEY, "granted");
    window.localStorage.setItem(PWA_KEYS.ONBOARDING_SEEN, "true");
    window.localStorage.setItem(PWA_KEYS.SESSIONS, "3");
    window.localStorage.setItem(PWA_KEYS.DISMISSED_UNTIL, "9999999999999");
    window.localStorage.setItem("theme", "dark");
    window.sessionStorage.setItem("kebapp_last_user_pos", '{"lat":45,"lng":9}');
    window.sessionStorage.setItem(SESSION_COUNTED_KEY, "true");

    await upsertDiaryEntry({
      place_id: "place_size_1",
      shop_label: "Size Shop",
      score_meat: 5,
      score_bread: 4,
      score_sauces: 4,
      score_value: 5,
    });
    await upsertWishlistEntry({
      place_id: "place_size_2",
      shop_label: "Wish Size Shop",
    });
    await upsertMapCacheEntries([{ place_id: "cache_1", latitude: 45, longitude: 9 }]);

    const estimate = await estimateLocalStorageUsage();
    expect(estimate.totalBytes).toBeGreaterThan(0);
    expect(estimate.stores.diary.count).toBe(1);
    expect(estimate.stores.wishlist.count).toBe(1);
    expect(estimate.stores.mapCache.count).toBe(1);
    expect(formatBytes(estimate.totalBytes)).toMatch(/B|KB|MB/);

    await resetAllLocalData();

    expect(await listDiaryEntries()).toHaveLength(0);
    expect(await listWishlistEntries()).toHaveLength(0);
    expect(await getMapCacheEntries()).toHaveLength(0);
    expect(window.localStorage.getItem(GPS_CONSENT_KEY)).toBeNull();
    expect(window.localStorage.getItem(MAPS_CONSENT_KEY)).toBeNull();
    expect(window.localStorage.getItem(PWA_KEYS.ONBOARDING_SEEN)).toBeNull();
    expect(window.localStorage.getItem(PWA_KEYS.SESSIONS)).toBeNull();
    expect(window.localStorage.getItem(PWA_KEYS.DISMISSED_UNTIL)).toBeNull();
    // Theme setting must survive personal data reset
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(window.sessionStorage.getItem("kebapp_last_user_pos")).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_COUNTED_KEY)).toBeNull();

    // Subsequent profile read recreates clean default profile
    expect((await getLocalProfile()).nickname).toBe(DEFAULT_NICKNAME);
  });
});
