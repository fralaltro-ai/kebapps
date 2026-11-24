"use client";

import { useState, useCallback, useEffect } from "react";
import {
  deleteWishlistEntry,
  listWishlistEntries,
  upsertWishlistEntry,
} from "@/lib/local-storage/db";
import type { WishlistEntry } from "@/lib/local-storage/schema";

export interface WishlistShopTarget {
  place_id: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coords_expires_at?: number | null;
  note?: string;
}

/**
 * Local-first personal wishlist hook backed by versioned IndexedDB.
 */
export function useUserWishlist() {
  const [wishlistMap, setWishlistMap] = useState<Map<string, WishlistEntry>>(new Map());
  const [isLoadingWishlist, setIsLoadingWishlist] = useState(true);

  const refreshWishlist = useCallback(async () => {
    setIsLoadingWishlist(true);
    try {
      const entries = await listWishlistEntries();
      const next = new Map<string, WishlistEntry>();
      for (const entry of entries) {
        next.set(entry.place_id, entry);
      }
      setWishlistMap(next);
    } finally {
      setIsLoadingWishlist(false);
    }
  }, []);

  useEffect(() => {
    void refreshWishlist();
  }, [refreshWishlist]);

  const isInWishlist = useCallback(
    (placeId: string): boolean => wishlistMap.has(placeId),
    [wishlistMap]
  );

  const toggleWishlistShop = useCallback(
    async (shop: WishlistShopTarget): Promise<boolean> => {
      if (wishlistMap.has(shop.place_id)) {
        setWishlistMap((prev) => {
          const next = new Map(prev);
          next.delete(shop.place_id);
          return next;
        });
        await deleteWishlistEntry(shop.place_id);
        return false;
      }

      const saved = await upsertWishlistEntry({
        place_id: shop.place_id,
        shop_label: shop.name?.trim() || shop.place_id,
        note: shop.note ?? "",
        latitude: shop.latitude ?? null,
        longitude: shop.longitude ?? null,
        coords_expires_at: shop.coords_expires_at ?? null,
      });

      setWishlistMap((prev) => {
        const next = new Map(prev);
        next.set(shop.place_id, saved);
        return next;
      });
      return true;
    },
    [wishlistMap]
  );

  const removeWishlistShop = useCallback(async (placeId: string): Promise<void> => {
    setWishlistMap((prev) => {
      const next = new Map(prev);
      next.delete(placeId);
      return next;
    });
    await deleteWishlistEntry(placeId);
  }, []);

  return {
    wishlistMap,
    isInWishlist,
    toggleWishlistShop,
    removeWishlistShop,
    refreshWishlist,
    isLoadingWishlist,
  };
}
