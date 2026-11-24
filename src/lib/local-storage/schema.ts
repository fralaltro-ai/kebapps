import { z } from "zod";
z.config({ jitless: true });
import { placeIdSchema } from "@/lib/validate";

export const AVATAR_IDS = [
  "maestro_spiedo",
  "signore_salsa",
  "ninja_cipolla",
  "cavaliere_falafel",
  "guardiano_pita",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR_ID: AvatarId = "maestro_spiedo";
export const DEFAULT_NICKNAME = "Esploratore dello Spiedo";

export const MAX_NICKNAME_LENGTH = 32;
export const MAX_SHOP_LABEL_LENGTH = 120;
export const MAX_GEO_LABEL_LENGTH = 80;
export const MAX_DIARY_NOTE_LENGTH = 280;
export const MAX_WISHLIST_NOTE_LENGTH = 200;

export const MAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const GOOGLE_COORDS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 consecutive calendar days max per Google Maps Platform Terms
export const MAP_CACHE_MAX_ENTRIES = 150;

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_APP_ID = "kebapps-local" as const;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_BACKUP_COLLECTION_ITEMS = 2000;

export const LOCAL_PROFILE_ID = "local_user" as const;

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Timestamp ISO non valido",
  });

const nullableTrimmedText = (max: number) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null) return null;
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
      return val;
    },
    z.string().max(max).nullable()
  );

const nullableCoordinate = (min: number, max: number) =>
  z.preprocess(
    (val) => (val === undefined ? null : val),
    z.number().finite().min(min).max(max).nullable()
  );

const scoreDimensionSchema = z.number().int().min(1).max(5);

export const AvatarIdSchema = z.enum(AVATAR_IDS);

export const LocalProfileSchema = z
  .object({
    id: z.literal(LOCAL_PROFILE_ID),
    nickname: z.string().trim().min(1).max(MAX_NICKNAME_LENGTH),
    avatar_id: AvatarIdSchema,
    created_at: isoTimestampSchema,
    updated_at: isoTimestampSchema,
  })
  .strict();

export type LocalProfile = z.infer<typeof LocalProfileSchema>;

export const LocalProfilePatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(MAX_NICKNAME_LENGTH).optional(),
    avatar_id: AvatarIdSchema.optional(),
  })
  .strict();

export type LocalProfilePatch = z.infer<typeof LocalProfilePatchSchema>;

export const DiaryEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    place_id: placeIdSchema,
    shop_label: z.string().trim().min(1).max(MAX_SHOP_LABEL_LENGTH),
    city: nullableTrimmedText(MAX_GEO_LABEL_LENGTH).default(null),
    country: nullableTrimmedText(MAX_GEO_LABEL_LENGTH).default(null),
    latitude: nullableCoordinate(-90, 90).default(null),
    longitude: nullableCoordinate(-180, 180).default(null),
    coords_expires_at: z.preprocess(
      (val) => (val === undefined ? null : val),
      z.number().int().nonnegative().nullable()
    ).default(null),
    score_overall: z.number().finite().min(1).max(5),
    score_meat: scoreDimensionSchema,
    score_bread: scoreDimensionSchema,
    score_sauces: scoreDimensionSchema,
    score_value: scoreDimensionSchema,
    score_location: z.preprocess(
      (val) => (val === undefined ? null : val),
      scoreDimensionSchema.nullable()
    ).default(null),
    note: z.string().trim().max(MAX_DIARY_NOTE_LENGTH).default(""),
    visited_at: isoTimestampSchema,
    created_at: isoTimestampSchema,
    updated_at: isoTimestampSchema,
  })
  .strict();

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

export const DiaryEntryInputSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    place_id: placeIdSchema,
    shop_label: z.string().trim().min(1).max(MAX_SHOP_LABEL_LENGTH),
    city: nullableTrimmedText(MAX_GEO_LABEL_LENGTH).optional(),
    country: nullableTrimmedText(MAX_GEO_LABEL_LENGTH).optional(),
    latitude: nullableCoordinate(-90, 90).optional(),
    longitude: nullableCoordinate(-180, 180).optional(),
    coords_expires_at: z.number().int().nonnegative().nullable().optional(),
    score_overall: z.number().finite().min(1).max(5).optional(),
    score_meat: scoreDimensionSchema,
    score_bread: scoreDimensionSchema,
    score_sauces: scoreDimensionSchema,
    score_value: scoreDimensionSchema,
    score_location: scoreDimensionSchema.nullable().optional(),
    note: z.string().trim().max(MAX_DIARY_NOTE_LENGTH).optional(),
    visited_at: isoTimestampSchema.optional(),
  })
  .strict();

export type DiaryEntryInput = z.infer<typeof DiaryEntryInputSchema>;

export const WishlistEntrySchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    place_id: placeIdSchema,
    shop_label: z.string().trim().min(1).max(MAX_SHOP_LABEL_LENGTH),
    note: z.string().trim().max(MAX_WISHLIST_NOTE_LENGTH).default(""),
    latitude: nullableCoordinate(-90, 90).default(null),
    longitude: nullableCoordinate(-180, 180).default(null),
    coords_expires_at: z.preprocess(
      (val) => (val === undefined ? null : val),
      z.number().int().nonnegative().nullable()
    ).default(null),
    sort_order: z.number().int().min(0).default(0),
    added_at: isoTimestampSchema,
  })
  .strict();

export type WishlistEntry = z.infer<typeof WishlistEntrySchema>;

export const WishlistEntryInputSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    place_id: placeIdSchema,
    shop_label: z.string().trim().min(1).max(MAX_SHOP_LABEL_LENGTH),
    note: z.string().trim().max(MAX_WISHLIST_NOTE_LENGTH).optional(),
    latitude: nullableCoordinate(-90, 90).optional(),
    longitude: nullableCoordinate(-180, 180).optional(),
    coords_expires_at: z.number().int().nonnegative().nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
    added_at: isoTimestampSchema.optional(),
  })
  .strict();

export type WishlistEntryInput = z.infer<typeof WishlistEntryInputSchema>;

// Google Maps Platform EEA + ToS compliance: ephemeral map_cache stores ONLY
// place_id + temporary coordinates (TTL <= 24h), never names/addresses/city.
export const MapCacheEntrySchema = z
  .object({
    place_id: placeIdSchema,
    latitude: nullableCoordinate(-90, 90).default(null),
    longitude: nullableCoordinate(-180, 180).default(null),
    cached_at: z.number().int().nonnegative(),
    expires_at: z.number().int().nonnegative(),
    last_accessed_at: z.number().int().nonnegative(),
  })
  .strict();

export type MapCacheEntry = z.infer<typeof MapCacheEntrySchema>;

export interface MapCacheShopInput {
  place_id: string;
  latitude?: number | null;
  longitude?: number | null;
}

export const BackupBundleSchema = z
  .object({
    schema_version: z.literal(BACKUP_SCHEMA_VERSION),
    app: z.literal(BACKUP_APP_ID),
    exported_at: isoTimestampSchema,
    data: z
      .object({
        profile: LocalProfileSchema,
        diary: z.array(DiaryEntrySchema).max(MAX_BACKUP_COLLECTION_ITEMS),
        wishlist: z.array(WishlistEntrySchema).max(MAX_BACKUP_COLLECTION_ITEMS),
      })
      .strict(),
  })
  .strict();

export type BackupBundle = z.infer<typeof BackupBundleSchema>;
