"use client";

import { useState, useCallback, useEffect } from "react";
import {
  deleteDiaryEntry,
  listDiaryEntries,
  upsertDiaryEntry,
} from "@/lib/local-storage/db";
import type { DiaryEntry } from "@/lib/local-storage/schema";

export interface UserReview {
  id?: string;
  place_id: string;
  shop_label?: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coords_expires_at?: number | null;
  score_overall?: number;
  score_meat: number;
  score_sauces: number;
  score_bread: number;
  score_value: number;
  score_location: number | null;
  note?: string;
  visited_at?: string;
  created_at: string;
}

function toUserReview(entry: DiaryEntry): UserReview {
  return {
    id: entry.id,
    place_id: entry.place_id,
    shop_label: entry.shop_label,
    city: entry.city,
    country: entry.country,
    latitude: entry.latitude,
    longitude: entry.longitude,
    coords_expires_at: entry.coords_expires_at,
    score_overall: entry.score_overall,
    score_meat: entry.score_meat,
    score_sauces: entry.score_sauces,
    score_bread: entry.score_bread,
    score_value: entry.score_value,
    score_location: entry.score_location,
    note: entry.note,
    visited_at: entry.visited_at,
    created_at: entry.created_at,
  };
}

/**
 * Local-first personal diary hook backed by versioned IndexedDB (with graceful
 * in-memory fallback when browser storage is unavailable).
 */
export function useUserReviews() {
  const [reviewsMap, setReviewsMap] = useState<Map<string, UserReview>>(new Map());
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  const refreshReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const entries = await listDiaryEntries();
      const next = new Map<string, UserReview>();
      for (const entry of entries) {
        next.set(entry.place_id, toUserReview(entry));
      }
      setReviewsMap(next);
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    void refreshReviews();
  }, [refreshReviews]);

  const getReviewForShop = useCallback(
    (placeId: string): UserReview | null => {
      return reviewsMap.get(placeId) || null;
    },
    [reviewsMap]
  );

  const setReviewForShop = useCallback((placeId: string, review: UserReview) => {
    setReviewsMap((prev) => {
      const next = new Map(prev);
      next.set(placeId, review);
      return next;
    });

    void upsertDiaryEntry({
      place_id: placeId,
      shop_label: review.shop_label?.trim() || placeId,
      city: review.city ?? null,
      country: review.country ?? null,
      latitude: review.latitude ?? null,
      longitude: review.longitude ?? null,
      coords_expires_at: review.coords_expires_at ?? null,
      score_overall: review.score_overall,
      score_meat: review.score_meat,
      score_bread: review.score_bread,
      score_sauces: review.score_sauces,
      score_value: review.score_value,
      score_location: review.score_location,
      note: review.note ?? "",
      visited_at: review.visited_at ?? review.created_at,
    }).catch(() => {
      // ignore background persistence failures; UI state stays responsive
    });
  }, []);

  const removeReviewForShop = useCallback((placeId: string) => {
    setReviewsMap((prev) => {
      const next = new Map(prev);
      next.delete(placeId);
      return next;
    });

    void deleteDiaryEntry(placeId).catch(() => {
      // ignore background persistence failures
    });
  }, []);

  return {
    reviewsMap,
    getReviewForShop,
    setReviewForShop,
    removeReviewForShop,
    refreshReviews,
    isLoadingReviews,
  };
}
