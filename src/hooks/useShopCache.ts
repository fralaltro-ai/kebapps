"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  clearMapCache,
  getMapCacheEntries,
  purgeExpiredMapCache,
  upsertMapCacheEntries,
} from "@/lib/local-storage/db";
import { MAX_BOUNDS_SPAN_DEG } from "@/lib/map-proxy-config";

export interface KebabShop {
  place_id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  data_source?: "google" | "fixture" | "cache";
}

export type ShopWithCoords = KebabShop;

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes viewport freshness; IndexedDB store enforces <= 24h TTL + LRU cap
export const EXPAND_PADDING_RATIO = 0.05;
export const INITIAL_EXPAND_PADDING_RATIO = 0.05;
export const DRILLDOWN_EXPAND_PADDING_RATIO = 0.05;
export const BOUNDS_QUANTIZATION_DEG = 0.005; // ~550m grid step so viewport center never leaks exact GPS fix
const MAX_CACHED_REGIONS = 24;
const SATURATED_DRILLDOWN_ZOOM_DELTA = 1.5;

export interface ExpandedBounds {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
}

export interface CacheRegionMeta {
  zoom?: number;
  saturated?: boolean;
}

export type BoundingBox = google.maps.LatLngBounds | ExpandedBounds;

interface CachedRegion {
  bounds: ExpandedBounds;
  zoom: number | null;
  saturated: boolean;
  timestamp: number;
}

interface SpatialCacheEntry {
  shops: KebabShop[];
  regions: CachedRegion[];
}

// Module-level singleton — survives component re-renders within the active tab
let spatialCache: SpatialCacheEntry | null = null;

/**
 * Merges two arrays of shops deduplicating by place_id.
 * Incoming items overwrite matching place_ids while preserving prior cached entries.
 */
export function mergeShopsById<T extends { place_id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  for (const shop of existing) {
    if (shop && shop.place_id) {
      map.set(shop.place_id, shop);
    }
  }
  for (const shop of incoming) {
    if (shop && shop.place_id) {
      map.set(shop.place_id, shop);
    }
  }
  return Array.from(map.values());
}

/**
 * Applies a minimal marker-edge buffer (default 5%) and quantizes bounds outward
 * to a ~550m grid (`BOUNDS_QUANTIZATION_DEG`) so the rectangle center sent to
 * `/api/shops` never reveals exact user GPS coordinates and no out-of-viewport
 * pre-fetching occurs.
 * Clamps expanded latSpan and lngSpan symmetrically around midpoint so neither ever
 * exceeds MAX_BOUNDS_SPAN_DEG * 0.98 (prevents HTTP 400 on /api/shops on wide tablets/desktops at zoom 13).
 */
export function expandBounds(
  bounds: BoundingBox,
  paddingRatio: number = EXPAND_PADDING_RATIO
): ExpandedBounds {
  let neLat: number;
  let neLng: number;
  let swLat: number;
  let swLng: number;

  if (
    typeof (bounds as google.maps.LatLngBounds).getNorthEast === "function" &&
    typeof (bounds as google.maps.LatLngBounds).getSouthWest === "function"
  ) {
    const latLngBounds = bounds as google.maps.LatLngBounds;
    neLat = latLngBounds.getNorthEast().lat();
    neLng = latLngBounds.getNorthEast().lng();
    swLat = latLngBounds.getSouthWest().lat();
    swLng = latLngBounds.getSouthWest().lng();
  } else {
    const raw = bounds as ExpandedBounds;
    neLat = raw.neLat;
    neLng = raw.neLng;
    swLat = raw.swLat;
    swLng = raw.swLng;
  }

  const latSpan = neLat - swLat;
  const lngSpan = neLng - swLng;
  const latPadding = latSpan * paddingRatio;
  const lngPadding = lngSpan * paddingRatio;

  const roundGrid = (val: number) => Number(val.toFixed(6));

  let expandedNeLat = Math.min(
    roundGrid(Math.ceil((neLat + latPadding) / BOUNDS_QUANTIZATION_DEG - 1e-9) * BOUNDS_QUANTIZATION_DEG),
    85
  );
  let expandedSwLat = Math.max(
    roundGrid(Math.floor((swLat - latPadding) / BOUNDS_QUANTIZATION_DEG + 1e-9) * BOUNDS_QUANTIZATION_DEG),
    -85
  );
  let expandedNeLng = Math.min(
    roundGrid(Math.ceil((neLng + lngPadding) / BOUNDS_QUANTIZATION_DEG - 1e-9) * BOUNDS_QUANTIZATION_DEG),
    180
  );
  let expandedSwLng = Math.max(
    roundGrid(Math.floor((swLng - lngPadding) / BOUNDS_QUANTIZATION_DEG + 1e-9) * BOUNDS_QUANTIZATION_DEG),
    -180
  );

  const maxAllowedSpan = MAX_BOUNDS_SPAN_DEG * 0.98;

  const curLatSpan = expandedNeLat - expandedSwLat;
  if (curLatSpan > maxAllowedSpan) {
    const midLat = (expandedNeLat + expandedSwLat) / 2;
    expandedNeLat = midLat + maxAllowedSpan / 2;
    expandedSwLat = midLat - maxAllowedSpan / 2;
    if (expandedNeLat > 85) {
      expandedNeLat = 85;
      expandedSwLat = 85 - maxAllowedSpan;
    } else if (expandedSwLat < -85) {
      expandedSwLat = -85;
      expandedNeLat = -85 + maxAllowedSpan;
    }
  }

  const curLngSpan = expandedNeLng - expandedSwLng;
  if (curLngSpan > maxAllowedSpan) {
    const midLng = (expandedNeLng + expandedSwLng) / 2;
    expandedNeLng = midLng + maxAllowedSpan / 2;
    expandedSwLng = midLng - maxAllowedSpan / 2;
    if (expandedNeLng > 180) {
      expandedNeLng = 180;
      expandedSwLng = 180 - maxAllowedSpan;
    } else if (expandedSwLng < -180) {
      expandedSwLng = -180;
      expandedNeLng = -180 + maxAllowedSpan;
    }
  }

  return {
    neLat: expandedNeLat,
    neLng: expandedNeLng,
    swLat: expandedSwLat,
    swLng: expandedSwLng,
  };
}

function isRegionCoveringViewport(
  viewportBounds: google.maps.LatLngBounds,
  regionBounds: ExpandedBounds
): boolean {
  const ne = viewportBounds.getNorthEast();
  const sw = viewportBounds.getSouthWest();

  const directlyContained =
    sw.lat() >= regionBounds.swLat &&
    sw.lng() >= regionBounds.swLng &&
    ne.lat() <= regionBounds.neLat &&
    ne.lng() <= regionBounds.neLng;

  if (directlyContained) {
    return true;
  }

  // On ultra-wide screens where viewport itself is clamped to MAX_BOUNDS_SPAN_DEG * 0.98,
  // compare clamped bounds to prevent refetching the identical clamped rectangle.
  const maxAllowedSpan = MAX_BOUNDS_SPAN_DEG * 0.98;
  if (ne.lat() - sw.lat() > maxAllowedSpan || ne.lng() - sw.lng() > maxAllowedSpan) {
    const clamped = expandBounds(viewportBounds);
    const eps = 1e-4;
    return (
      Math.abs(clamped.swLat - regionBounds.swLat) <= eps &&
      Math.abs(clamped.swLng - regionBounds.swLng) <= eps &&
      Math.abs(clamped.neLat - regionBounds.neLat) <= eps &&
      Math.abs(clamped.neLng - regionBounds.neLng) <= eps
    );
  }

  return false;
}

function isUnionCoveringViewport(
  viewportBounds: google.maps.LatLngBounds,
  regions: CachedRegion[]
): boolean {
  const ne = viewportBounds.getNorthEast();
  const sw = viewportBounds.getSouthWest();
  const vSwLat = sw.lat();
  const vSwLng = sw.lng();
  const vNeLat = ne.lat();
  const vNeLng = ne.lng();

  if (vNeLat <= vSwLat || vNeLng <= vSwLng) return false;

  const overlapping = regions
    .map((r) => ({
      swLat: Math.max(vSwLat, r.bounds.swLat),
      swLng: Math.max(vSwLng, r.bounds.swLng),
      neLat: Math.min(vNeLat, r.bounds.neLat),
      neLng: Math.min(vNeLng, r.bounds.neLng),
    }))
    .filter((b) => b.neLat > b.swLat && b.neLng > b.swLng);

  if (overlapping.length < 2) return false;

  const latCuts = Array.from(
    new Set([vSwLat, vNeLat, ...overlapping.flatMap((b) => [b.swLat, b.neLat])])
  ).sort((a, b) => a - b);
  const lngCuts = Array.from(
    new Set([vSwLng, vNeLng, ...overlapping.flatMap((b) => [b.swLng, b.neLng])])
  ).sort((a, b) => a - b);

  for (let i = 0; i < latCuts.length - 1; i++) {
    if (latCuts[i + 1] - latCuts[i] <= 1e-7) continue;
    const midLat = (latCuts[i] + latCuts[i + 1]) / 2;
    for (let j = 0; j < lngCuts.length - 1; j++) {
      if (lngCuts[j + 1] - lngCuts[j] <= 1e-7) continue;
      const midLng = (lngCuts[j] + lngCuts[j + 1]) / 2;
      const covered = overlapping.some(
        (b) =>
          midLat >= b.swLat &&
          midLat <= b.neLat &&
          midLng >= b.swLng &&
          midLng <= b.neLng
      );
      if (!covered) return false;
    }
  }

  return true;
}

function getFreshRegions(cached: SpatialCacheEntry | null): CachedRegion[] {
  if (!cached || cached.regions.length === 0) return [];
  const now = Date.now();
  const fresh = cached.regions.filter((r) => now - r.timestamp <= CACHE_TTL_MS);
  if (fresh.length !== cached.regions.length) {
    cached.regions = fresh;
  }
  return fresh;
}

function requiresDrilldown(region: CachedRegion, currentZoom?: number): boolean {
  return Boolean(
    region.saturated &&
      currentZoom !== undefined &&
      region.zoom !== null &&
      currentZoom >= region.zoom + SATURATED_DRILLDOWN_ZOOM_DELTA
  );
}

export function clearMemoryShopCache(): void {
  spatialCache = null;
}

export function useShopCache(options?: { onHydrated?: (shops: KebabShop[]) => void }) {
  const lastFetchBoundsRef = useRef<SpatialCacheEntry | null>(spatialCache);
  const onHydratedRef = useRef(options?.onHydrated);
  onHydratedRef.current = options?.onHydrated;

  useEffect(() => {
    let active = true;

    void purgeExpiredMapCache()
      .then(() => getMapCacheEntries({ touchAccess: false }))
      .then((entries) => {
        if (!active || entries.length === 0) return;
        const hydrated: KebabShop[] = entries.map((entry) => ({
          place_id: entry.place_id,
          name: null,
          latitude: entry.latitude,
          longitude: entry.longitude,
          address: null,
          city: null,
          region: null,
          country: null,
          data_source: "cache",
        }));

        if (!spatialCache || spatialCache.shops.length === 0) {
          // Keep regions empty so the first viewport check still fetches fresh pins
          const entry: SpatialCacheEntry = {
            shops: hydrated,
            regions: [],
          };
          spatialCache = entry;
          lastFetchBoundsRef.current = entry;
        }
        onHydratedRef.current?.(spatialCache.shops);
      })
      .catch(() => {
        // ignore ephemeral cache hydration failures
      });

    return () => {
      active = false;
    };
  }, []);

  const shouldFetch = useCallback(
    (viewportBounds: google.maps.LatLngBounds, currentZoom?: number): boolean => {
      const freshRegions = getFreshRegions(lastFetchBoundsRef.current);
      if (freshRegions.length === 0) return true;

      const eligibleRegions = freshRegions.filter(
        (region) => !requiresDrilldown(region, currentZoom)
      );
      if (eligibleRegions.length === 0) return true;

      if (eligibleRegions.some((region) => isRegionCoveringViewport(viewportBounds, region.bounds))) {
        return false;
      }

      if (isUnionCoveringViewport(viewportBounds, eligibleRegions)) {
        return false;
      }

      return true;
    },
    []
  );

  const isSaturatedDrilldown = useCallback(
    (viewportBounds: google.maps.LatLngBounds, currentZoom?: number): boolean => {
      const freshRegions = getFreshRegions(lastFetchBoundsRef.current);
      if (freshRegions.length === 0) return false;

      const hasCoveringNonDrilldown = freshRegions.some(
        (region) =>
          !requiresDrilldown(region, currentZoom) &&
          isRegionCoveringViewport(viewportBounds, region.bounds)
      );
      if (hasCoveringNonDrilldown) return false;

      return freshRegions.some(
        (region) =>
          requiresDrilldown(region, currentZoom) &&
          isRegionCoveringViewport(viewportBounds, region.bounds)
      );
    },
    []
  );

  const getCachedShops = useCallback((): KebabShop[] => {
    return lastFetchBoundsRef.current?.shops || [];
  }, []);

  const setCache = useCallback(
    (expandedBounds: ExpandedBounds, newShops: KebabShop[], meta?: CacheRegionMeta) => {
      const now = Date.now();
      const prevShops = lastFetchBoundsRef.current?.shops || [];
      const prevRegions = (lastFetchBoundsRef.current?.regions || []).filter(
        (r) => now - r.timestamp <= CACHE_TTL_MS
      );
      const mergedShops = mergeShopsById(prevShops, newShops);
      const nextRegion: CachedRegion = {
        bounds: expandedBounds,
        zoom: meta?.zoom ?? null,
        saturated: Boolean(meta?.saturated),
        timestamp: now,
      };
      const dedupedRegions = prevRegions.filter((r) => {
        const eps = 1e-4;
        return !(
          Math.abs(r.bounds.swLat - expandedBounds.swLat) <= eps &&
          Math.abs(r.bounds.swLng - expandedBounds.swLng) <= eps &&
          Math.abs(r.bounds.neLat - expandedBounds.neLat) <= eps &&
          Math.abs(r.bounds.neLng - expandedBounds.neLng) <= eps
        );
      });
      dedupedRegions.push(nextRegion);
      const cappedRegions = dedupedRegions.slice(-MAX_CACHED_REGIONS);

      const entry: SpatialCacheEntry = {
        shops: mergedShops,
        regions: cappedRegions,
      };
      spatialCache = entry;
      lastFetchBoundsRef.current = entry;

      if (newShops.length > 0) {
        void upsertMapCacheEntries(
          newShops.map((shop) => ({
            place_id: shop.place_id,
            latitude: shop.latitude,
            longitude: shop.longitude,
          }))
        ).catch(() => {
          // ignore ephemeral persistence failures
        });
      }
    },
    []
  );

  const invalidateCache = useCallback(() => {
    spatialCache = null;
    lastFetchBoundsRef.current = null;
    void clearMapCache().catch(() => {
      // ignore ephemeral clear failures
    });
  }, []);

  return { shouldFetch, isSaturatedDrilldown, getCachedShops, setCache, invalidateCache };
}
