import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAllStores,
  deleteDiaryEntry,
  deleteWishlistEntry,
  getDiaryEntry,
  getLocalProfile,
  getMapCacheEntries,
  getMapCacheEntry,
  getWishlistEntry,
  isUsingMemoryFallback,
  listDiaryEntries,
  listWishlistEntries,
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  purgeExpiredMapCache,
  reorderWishlistEntries,
  resetLocalDbAdapterForTests,
  saveLocalProfile,
  STORE_NAMES,
  upsertDiaryEntry,
  upsertMapCacheEntries,
  upsertWishlistEntry,
} from "@/lib/local-storage/db";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_NICKNAME,
  DiaryEntryInputSchema,
  GOOGLE_COORDS_TTL_MS,
  MAP_CACHE_TTL_MS,
  MAX_DIARY_NOTE_LENGTH,
  MAX_WISHLIST_NOTE_LENGTH,
} from "@/lib/local-storage/schema";

interface FakeIdbHarness {
  factory: IDBFactory;
  stores: Map<string, Map<string, unknown>>;
}

function createFakeIndexedDb(): FakeIdbHarness {
  const stores = new Map<string, Map<string, unknown>>();

  const makeRequest = <T>(executor: () => T): IDBRequest<T> => {
    const req = {
      result: undefined as unknown as T,
      error: null as DOMException | null,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
    };
    queueMicrotask(() => {
      try {
        req.result = executor();
        req.onsuccess?.(new Event("success"));
      } catch (err) {
        req.error = err as DOMException;
        req.onerror?.(new Event("error"));
      }
    });
    return req as unknown as IDBRequest<T>;
  };

  const factory = {
    open: vi.fn(() => {
      const openReq = {
        result: null as unknown as IDBDatabase,
        error: null,
        onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onblocked: null as ((ev: Event) => void) | null,
      };

      const db = {
        name: LOCAL_DB_NAME,
        version: LOCAL_DB_VERSION,
        objectStoreNames: {
          contains: (name: string) => stores.has(name),
        },
        createObjectStore: (name: string) => {
          if (!stores.has(name)) {
            stores.set(name, new Map());
          }
          return {} as IDBObjectStore;
        },
        close: vi.fn(),
        transaction: (storeName: string) => {
          const tx = {
            oncomplete: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onabort: null as (() => void) | null,
            objectStore: (name: string) => {
              const target = stores.get(name) ?? stores.get(storeName);
              if (!target) {
                throw new Error(`Missing object store: ${name}`);
              }
              return {
                get: (key: string) => makeRequest(() => target.get(key)),
                getAll: () => makeRequest(() => Array.from(target.values())),
                put: (val: Record<string, unknown>) =>
                  makeRequest(() => {
                    const key = name === STORE_NAMES.PROFILE ? String(val.id) : String(val.place_id);
                    target.set(key, structuredClone(val));
                    return key;
                  }),
                delete: (key: string) =>
                  makeRequest(() => {
                    target.delete(key);
                    return undefined;
                  }),
                clear: () =>
                  makeRequest(() => {
                    target.clear();
                    return undefined;
                  }),
              } as unknown as IDBObjectStore;
            },
          };
          setTimeout(() => tx.oncomplete?.(), 0);
          return tx as unknown as IDBTransaction;
        },
      } as unknown as IDBDatabase;

      queueMicrotask(() => {
        openReq.result = db;
        openReq.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
        openReq.onsuccess?.(new Event("success"));
      });

      return openReq as unknown as IDBOpenDBRequest;
    }),
  } as unknown as IDBFactory;

  return { factory, stores };
}

describe("Local Storage DB (IndexedDB + Fallback + Schema)", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    await resetLocalDbAdapterForTests();
    await clearAllStores();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetLocalDbAdapterForTests();
  });

  describe("Graceful fallback and IndexedDB adapter", () => {
    it("falls back cleanly to memory when indexedDB is unavailable or throws", async () => {
      expect(isUsingMemoryFallback()).toBe(true);

      const profile = await getLocalProfile(new Date("2026-11-15T10:00:00.000Z"));
      expect(profile.nickname).toBe(DEFAULT_NICKNAME);
      expect(profile.avatar_id).toBe(DEFAULT_AVATAR_ID);

      // Simulate browser blocking indexedDB.open (e.g. strict private browsing)
      vi.stubGlobal("indexedDB", {
        open: () => {
          throw new DOMException("Storage disabled", "SecurityError");
        },
      });
      await resetLocalDbAdapterForTests();

      const updated = await saveLocalProfile(
        { nickname: "Re dello Spiedo", avatar_id: "ninja_cipolla" },
        new Date("2026-11-15T10:05:00.000Z")
      );
      expect(updated.nickname).toBe("Re dello Spiedo");
      expect(updated.avatar_id).toBe("ninja_cipolla");
    });

    it("uses IndexedDB object stores lazily (no write on read-only getLocalProfile)", async () => {
      const fake = createFakeIndexedDb();
      vi.stubGlobal("indexedDB", fake.factory);
      await resetLocalDbAdapterForTests();

      expect(isUsingMemoryFallback()).toBe(false);

      const defaultProfile = await getLocalProfile();
      expect(defaultProfile.nickname).toBe(DEFAULT_NICKNAME);
      expect(fake.stores.get(STORE_NAMES.PROFILE)?.size ?? 0).toBe(0);

      await saveLocalProfile({ nickname: "Ali Kebap", avatar_id: "signore_salsa" });
      expect(fake.stores.get(STORE_NAMES.PROFILE)?.size).toBe(1);
      await upsertDiaryEntry({
        place_id: "place_idb_1",
        shop_label: "Istanbul Doner",
        city: "Milano",
        country: "Italy",
        score_meat: 5,
        score_bread: 4,
        score_sauces: 5,
        score_value: 4,
        score_location: 4,
        note: "Carne ottima.",
      });

      expect(fake.stores.has(STORE_NAMES.PROFILE)).toBe(true);
      expect(fake.stores.has(STORE_NAMES.DIARY)).toBe(true);
      expect(fake.stores.has(STORE_NAMES.WISHLIST)).toBe(true);
      expect(fake.stores.has(STORE_NAMES.MAP_CACHE)).toBe(true);

      const fetched = await getDiaryEntry("place_idb_1");
      expect(fetched?.shop_label).toBe("Istanbul Doner");
      expect(fetched?.score_overall).toBe(4.4);
    });
  });

  describe("Profile CRUD", () => {
    it("creates default profile and rejects invalid avatar IDs", async () => {
      const initial = await getLocalProfile();
      expect(initial.id).toBe("local_user");
      expect(initial.avatar_id).toBe("maestro_spiedo");

      const updated = await saveLocalProfile({
        nickname: "  Sultan   ",
        avatar_id: "guardiano_pita",
      });
      expect(updated.nickname).toBe("Sultan");
      expect(updated.avatar_id).toBe("guardiano_pita");

      await expect(
        saveLocalProfile({ avatar_id: "custom_uploaded_image" as never })
      ).rejects.toThrow();
      await expect(saveLocalProfile({ nickname: "   " })).rejects.toThrow();
    });
  });

  describe("Diary CRUD & EEA / Memory Guardrails", () => {
    it("auto-fills visited_at and score_overall across all 5 rating dimensions", async () => {
      const now = new Date("2026-11-15T12:30:00.000Z");
      const entry = await upsertDiaryEntry(
        {
          place_id: "ChIJ_test_1",
          shop_label: "Kebab da Mustafa",
          city: "Milano",
          country: "Italy",
          score_meat: 5,
          score_bread: 4,
          score_sauces: 5,
          score_value: 3,
          score_location: 3,
          note: "Salsa yogurt top.",
        },
        now
      );

      expect(entry.visited_at).toBe(now.toISOString());
      expect(entry.created_at).toBe(now.toISOString());
      // (5 + 4 + 5 + 3 + 3) / 5 = 4.0
      expect(entry.score_overall).toBe(4);
      expect(entry.note).toBe("Salsa yogurt top.");

      const fetched = await getDiaryEntry("ChIJ_test_1");
      expect(fetched).toEqual(entry);

      const updated = await upsertDiaryEntry(
        {
          place_id: "ChIJ_test_1",
          shop_label: "Kebab da Mustafa",
          score_meat: 5,
          score_bread: 5,
          score_sauces: 5,
          score_value: 4,
          score_location: null,
          note: "Aggiornato.",
        },
        new Date("2026-11-16T12:30:00.000Z")
      );

      expect(updated.created_at).toBe(now.toISOString());
      expect(updated.visited_at).toBe(now.toISOString());
      expect(updated.score_overall).toBe(4.75);

      const deleted = await deleteDiaryEntry("ChIJ_test_1");
      expect(deleted).toBe(true);
      expect(await listDiaryEntries()).toHaveLength(0);
    });

    it("rejects photos, oversized notes, and disallowed Google metadata fields", async () => {
      expect(
        DiaryEntryInputSchema.safeParse({
          place_id: "ChIJ_bad_photo",
          shop_label: "Shop",
          score_meat: 4,
          score_bread: 4,
          score_sauces: 4,
          score_value: 4,
          photos: ["data:image/png;base64,abc"],
        }).success
      ).toBe(false);

      expect(
        DiaryEntryInputSchema.safeParse({
          place_id: "ChIJ_bad_google_meta",
          shop_label: "Shop",
          score_meat: 4,
          score_bread: 4,
          score_sauces: 4,
          score_value: 4,
          types: ["restaurant"],
        }).success
      ).toBe(false);

      expect(
        DiaryEntryInputSchema.safeParse({
          place_id: "ChIJ_long_note",
          shop_label: "Shop",
          score_meat: 4,
          score_bread: 4,
          score_sauces: 4,
          score_value: 4,
          note: "x".repeat(MAX_DIARY_NOTE_LENGTH + 1),
        }).success
      ).toBe(false);
    });

    it("automatically strips Google-sourced coordinates past 30-day TTL while keeping user data and place_id", async () => {
      const t0 = 1_700_000_000_000;
      const now = new Date(t0);

      await upsertDiaryEntry(
        {
          place_id: "ChIJ_google_ttl",
          shop_label: "Mio Kebab Preferito",
          latitude: 45.46,
          longitude: 9.19,
          coords_expires_at: t0 + GOOGLE_COORDS_TTL_MS * 3, // verify clamp to 30 days
          score_meat: 5,
          score_bread: 5,
          score_sauces: 4,
          score_value: 5,
        },
        now
      );

      await upsertWishlistEntry(
        {
          place_id: "ChIJ_wish_ttl",
          shop_label: "Da Provare",
          latitude: 45.47,
          longitude: 9.2,
          coords_expires_at: t0 + GOOGLE_COORDS_TTL_MS,
        },
        now
      );

      const beforeExpiryDiary = await getDiaryEntry("ChIJ_google_ttl", t0 + GOOGLE_COORDS_TTL_MS - 1000);
      expect(beforeExpiryDiary?.latitude).toBe(45.46);
      expect(beforeExpiryDiary?.coords_expires_at).toBe(t0 + GOOGLE_COORDS_TTL_MS);

      const afterExpiryDiary = await listDiaryEntries(t0 + GOOGLE_COORDS_TTL_MS + 1);
      expect(afterExpiryDiary[0].latitude).toBeNull();
      expect(afterExpiryDiary[0].longitude).toBeNull();
      expect(afterExpiryDiary[0].coords_expires_at).toBeNull();
      expect(afterExpiryDiary[0].place_id).toBe("ChIJ_google_ttl");
      expect(afterExpiryDiary[0].shop_label).toBe("Mio Kebab Preferito");

      const afterExpiryWish = await getWishlistEntry("ChIJ_wish_ttl", t0 + GOOGLE_COORDS_TTL_MS + 1);
      expect(afterExpiryWish?.latitude).toBeNull();
      expect(afterExpiryWish?.longitude).toBeNull();
      expect(afterExpiryWish?.coords_expires_at).toBeNull();
      expect(afterExpiryWish?.place_id).toBe("ChIJ_wish_ttl");
    });
  });

  describe("Wishlist CRUD & Reordering", () => {
    it("supports add, note limit validation, reorder, and delete", async () => {
      const first = await upsertWishlistEntry(
        { place_id: "wish_1", shop_label: "Doner Uno", note: "Provare pita" },
        new Date("2026-11-15T10:00:00.000Z")
      );
      const second = await upsertWishlistEntry(
        { place_id: "wish_2", shop_label: "Doner Due", note: "Piccante" },
        new Date("2026-11-15T11:00:00.000Z")
      );

      expect(first.sort_order).toBe(0);
      expect(second.sort_order).toBe(1);

      const reordered = await reorderWishlistEntries(["wish_2", "wish_1"]);
      expect(reordered.map((w) => w.place_id)).toEqual(["wish_2", "wish_1"]);
      expect(reordered[0].sort_order).toBe(0);
      expect(reordered[1].sort_order).toBe(1);

      await expect(
        upsertWishlistEntry({
          place_id: "wish_long",
          shop_label: "Doner Tre",
          note: "n".repeat(MAX_WISHLIST_NOTE_LENGTH + 1),
        })
      ).rejects.toThrow();

      expect(await deleteWishlistEntry("wish_1")).toBe(true);
      expect(await getWishlistEntry("wish_1")).toBeNull();
      expect(await listWishlistEntries()).toHaveLength(1);
    });
  });

  describe("Ephemeral Map Cache (TTL & LRU Eviction)", () => {
    it("strips forbidden Google metadata and text fields and expires entries past TTL", async () => {
      const t0 = 1_700_000_000_000;
      const ttlMs = 60_000;

      await upsertMapCacheEntries(
        [
          {
            place_id: "shop_ttl_1",
            latitude: 45.46,
            longitude: 9.19,
            ...({
              name: "Kebab Cache",
              address: "Via Roma 1",
              city: "Milano",
              types: ["restaurant", "food"],
              primaryType: "restaurant",
            } as Record<string, unknown>),
          },
        ],
        { nowMs: t0, ttlMs }
      );

      const valid = await getMapCacheEntry("shop_ttl_1", { nowMs: t0 + 30_000 });
      expect(valid).not.toBeNull();
      expect(valid).not.toHaveProperty("name");
      expect(valid).not.toHaveProperty("address");
      expect(valid).not.toHaveProperty("city");
      expect(valid).not.toHaveProperty("types");
      expect(valid).not.toHaveProperty("primaryType");
      expect(valid?.expires_at).toBe(t0 + ttlMs);

      // Past TTL -> expired and automatically purged
      const expiredRead = await getMapCacheEntry("shop_ttl_1", { nowMs: t0 + ttlMs + 1 });
      expect(expiredRead).toBeNull();
      expect(await getMapCacheEntries({ nowMs: t0 + ttlMs + 1 })).toHaveLength(0);
    });

    it("caps TTL at 24h max even if caller asks for longer and purges stale rows", async () => {
      const t0 = 1_700_000_000_000;
      await upsertMapCacheEntries(
        [{ place_id: "shop_cap", latitude: 41.9, longitude: 12.5 }],
        { nowMs: t0, ttlMs: MAP_CACHE_TTL_MS * 10 }
      );

      const entry = await getMapCacheEntry("shop_cap", { nowMs: t0 + 1000 });
      expect(entry?.expires_at).toBe(t0 + MAP_CACHE_TTL_MS);

      const purged = await purgeExpiredMapCache(t0 + MAP_CACHE_TTL_MS + 1);
      expect(purged).toBe(1);
    });

    it("evicts least recently accessed entries when maxEntries limit is exceeded", async () => {
      const t0 = 1_700_000_000_000;

      await upsertMapCacheEntries(
        [
          { place_id: "shop_a", latitude: 45.1, longitude: 9.1 },
          { place_id: "shop_b", latitude: 45.2, longitude: 9.2 },
          { place_id: "shop_c", latitude: 45.3, longitude: 9.3 },
        ],
        { nowMs: t0, maxEntries: 3 }
      );

      // Access shop_a later so shop_b becomes the least recently used entry
      const touchedA = await getMapCacheEntry("shop_a", { nowMs: t0 + 5_000 });
      expect(touchedA?.last_accessed_at).toBe(t0 + 5_000);

      // Insert shop_d with maxEntries=3 -> shop_b must be evicted
      const kept = await upsertMapCacheEntries(
        [{ place_id: "shop_d", latitude: 45.4, longitude: 9.4 }],
        { nowMs: t0 + 10_000, maxEntries: 3 }
      );

      const keptIds = kept.map((item) => item.place_id).sort();
      expect(keptIds).toEqual(["shop_a", "shop_c", "shop_d"]);
      expect(await getMapCacheEntry("shop_b", { nowMs: t0 + 10_001 })).toBeNull();
    });
  });
});
