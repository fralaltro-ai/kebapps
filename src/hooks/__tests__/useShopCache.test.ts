import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  BOUNDS_QUANTIZATION_DEG,
  clearMemoryShopCache,
  expandBounds,
  mergeShopsById,
  useShopCache,
  EXPAND_PADDING_RATIO,
  INITIAL_EXPAND_PADDING_RATIO,
  type KebabShop,
} from "../useShopCache";
import { MAX_BOUNDS_SPAN_DEG } from "@/lib/map-proxy-config";
import { resetLocalDbAdapterForTests } from "@/lib/local-storage/db";

function makeLatLngBounds(box: {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
}): google.maps.LatLngBounds {
  return {
    getNorthEast: () => ({ lat: () => box.neLat, lng: () => box.neLng }),
    getSouthWest: () => ({ lat: () => box.swLat, lng: () => box.swLng }),
  } as unknown as google.maps.LatLngBounds;
}

describe("useShopCache helpers", () => {
  beforeEach(async () => {
    clearMemoryShopCache();
    await resetLocalDbAdapterForTests();
  });

  describe("expandBounds", () => {
    it("expands viewport with minimal 5% buffer and quantizes outward to BOUNDS_QUANTIZATION_DEG (0.005)", () => {
      const input = {
        neLat: 45.48,
        neLng: 9.20,
        swLat: 45.46,
        swLng: 9.18,
      };
      // latSpan = 0.02, lngSpan = 0.02 => 5% padding = 0.001, quantized outward to 0.005 grid
      const result = expandBounds(input);

      expect(EXPAND_PADDING_RATIO).toBe(0.05);
      expect(BOUNDS_QUANTIZATION_DEG).toBe(0.005);
      expect(result.neLat).toBeCloseTo(45.485, 5);
      expect(result.swLat).toBeCloseTo(45.455, 5);
      expect(result.neLng).toBeCloseTo(9.205, 5);
      expect(result.swLng).toBeCloseTo(9.175, 5);
      expect(result.neLat - result.swLat).toBeLessThanOrEqual(MAX_BOUNDS_SPAN_DEG);
      expect(result.neLng - result.swLng).toBeLessThanOrEqual(MAX_BOUNDS_SPAN_DEG);
    });

    it("keeps INITIAL_EXPAND_PADDING_RATIO at 0.05 (no 9x out-of-viewport prefetch)", () => {
      const input = {
        neLat: 45.48,
        neLng: 9.20,
        swLat: 45.46,
        swLng: 9.18,
      };
      const result = expandBounds(input, INITIAL_EXPAND_PADDING_RATIO);

      expect(INITIAL_EXPAND_PADDING_RATIO).toBe(0.05);
      expect(result.neLat).toBeCloseTo(45.485, 5);
      expect(result.swLat).toBeCloseTo(45.455, 5);
      expect(result.neLng).toBeCloseTo(9.205, 5);
      expect(result.swLng).toBeCloseTo(9.175, 5);
      expect(result.neLat - result.swLat).toBeLessThanOrEqual(MAX_BOUNDS_SPAN_DEG);
      expect(result.neLng - result.swLng).toBeLessThanOrEqual(MAX_BOUNDS_SPAN_DEG);
    });

    it("covers original portrait viewport cleanly and snaps edges to the 0.005 degree grid", () => {
      const input = {
        neLat: 45.50,
        swLat: 45.40,
        neLng: 9.20,
        swLng: 9.16,
      };
      const result = expandBounds(input);

      expect(result.neLat).toBeGreaterThanOrEqual(input.neLat);
      expect(result.swLat).toBeLessThanOrEqual(input.swLat);
      expect(result.neLng).toBeGreaterThanOrEqual(input.neLng);
      expect(result.swLng).toBeLessThanOrEqual(input.swLng);
      expect(result.neLat).toBeCloseTo(45.505, 5);
      expect(result.swLat).toBeCloseTo(45.395, 5);
      expect(result.neLng).toBeCloseTo(9.205, 5);
      expect(result.swLng).toBeCloseTo(9.155, 5);
    });

    it("clamps wide viewports (latSpan=1.0, lngSpan=1.5) so span <= MAX_BOUNDS_SPAN_DEG (1.2) while preserving center", () => {
      const input = {
        neLat: 46.0,
        swLat: 45.0,
        neLng: 10.5,
        swLng: 9.0,
      };
      const result = expandBounds(input);

      const maxAllowed = MAX_BOUNDS_SPAN_DEG * 0.98;
      const resLatSpan = result.neLat - result.swLat;
      const resLngSpan = result.neLng - result.swLng;

      expect(resLatSpan).toBeCloseTo(1.10, 4);
      expect(resLatSpan).toBeLessThanOrEqual(maxAllowed);
      expect(resLngSpan).toBeCloseTo(maxAllowed, 4);

      const resMidLat = (result.neLat + result.swLat) / 2;
      const resMidLng = (result.neLng + result.swLng) / 2;
      expect(resMidLat).toBeCloseTo(45.5, 4);
      expect(resMidLng).toBeCloseTo(9.75, 4);
    });

    it("handles google.maps.LatLngBounds duck-typing objects with getNorthEast and getSouthWest", () => {
      const mockLatLngBounds = makeLatLngBounds({
        neLat: 45.50,
        neLng: 9.25,
        swLat: 45.40,
        swLng: 9.15,
      });

      const result = expandBounds(mockLatLngBounds);
      expect(result.neLat).toBeGreaterThan(45.50);
      expect(result.swLat).toBeLessThan(45.40);
      expect(result.neLng).toBeGreaterThan(9.25);
      expect(result.swLng).toBeLessThan(9.15);
      expect(result.neLat - result.swLat).toBeLessThanOrEqual(MAX_BOUNDS_SPAN_DEG);
    });
  });

  describe("useShopCache region caching & drill-down", () => {
    it("caches empty regions so re-checking the same area does not trigger a refetch loop", () => {
      const { result } = renderHook(() => useShopCache());
      const viewport = makeLatLngBounds({
        neLat: 45.48,
        neLng: 9.20,
        swLat: 45.46,
        swLng: 9.18,
      });

      expect(result.current.shouldFetch(viewport, 14)).toBe(true);

      act(() => {
        result.current.setCache(expandBounds(viewport), [], { zoom: 14, saturated: false });
      });

      expect(result.current.shouldFetch(viewport, 14)).toBe(false);
    });

    it("caches multiple distinct regions across pan back-and-forth", () => {
      const { result } = renderHook(() => useShopCache());
      const regionA = makeLatLngBounds({
        neLat: 45.48,
        neLng: 9.20,
        swLat: 45.46,
        swLng: 9.18,
      });
      const regionB = makeLatLngBounds({
        neLat: 41.92,
        neLng: 12.52,
        swLat: 41.88,
        swLng: 12.48,
      });

      act(() => {
        result.current.setCache(expandBounds(regionA), [{ place_id: "a1", name: null, latitude: 45.47, longitude: 9.19 }], { zoom: 14, saturated: false });
        result.current.setCache(expandBounds(regionB), [{ place_id: "b1", name: null, latitude: 41.90, longitude: 12.50 }], { zoom: 14, saturated: false });
      });

      expect(result.current.shouldFetch(regionA, 14)).toBe(false);
      expect(result.current.shouldFetch(regionB, 14)).toBe(false);
    });

    it("triggers drill-down fetch only when cached region is saturated and zoom increases by >= 1.5", () => {
      const { result } = renderHook(() => useShopCache());
      const wideViewport = makeLatLngBounds({
        neLat: 45.50,
        neLng: 9.24,
        swLat: 45.44,
        swLng: 9.14,
      });
      const subViewport = makeLatLngBounds({
        neLat: 45.475,
        neLng: 9.195,
        swLat: 45.465,
        swLng: 9.185,
      });

      act(() => {
        result.current.setCache(expandBounds(wideViewport), [], { zoom: 13, saturated: true });
      });

      expect(result.current.shouldFetch(subViewport, 14)).toBe(false);
      expect(result.current.shouldFetch(subViewport, 15)).toBe(true);

      act(() => {
        result.current.setCache(expandBounds(wideViewport), [], { zoom: 13, saturated: false });
      });
      expect(result.current.shouldFetch(subViewport, 16)).toBe(false);
    });

    it("avoids refetch on micro-pan/zoom-in inside quantized grid while triggering fetch when panning outside visible bounds", () => {
      const { result } = renderHook(() => useShopCache());
      const initialViewport = makeLatLngBounds({
        neLat: 45.48,
        neLng: 9.20,
        swLat: 45.46,
        swLng: 9.18,
      });

      act(() => {
        result.current.setCache(
          expandBounds(initialViewport, INITIAL_EXPAND_PADDING_RATIO),
          [],
          { zoom: 14, saturated: false }
        );
      });

      // Small micro-pan within 0.005 quantized grid buffer stays cached
      const microPannedViewport = makeLatLngBounds({
        neLat: 45.483,
        neLng: 9.203,
        swLat: 45.463,
        swLng: 9.183,
      });
      expect(result.current.shouldFetch(microPannedViewport, 14)).toBe(false);

      // Zoom-in inside cached region stays cached
      const zoomedInViewport = makeLatLngBounds({
        neLat: 45.475,
        neLng: 9.195,
        swLat: 45.465,
        swLng: 9.185,
      });
      expect(result.current.shouldFetch(zoomedInViewport, 15)).toBe(false);

      // Large out-of-viewport pan (0.015 deg) fetches because no 9x prefetch occurred
      const farPannedViewport = makeLatLngBounds({
        neLat: 45.495,
        neLng: 9.215,
        swLat: 45.475,
        swLng: 9.195,
      });
      expect(result.current.shouldFetch(farPannedViewport, 14)).toBe(true);
    });

    it("checks 2D union coverage across adjacent cached regions", () => {
      const { result } = renderHook(() => useShopCache());
      const westRegion = {
        swLat: 45.45,
        swLng: 9.15,
        neLat: 45.49,
        neLng: 9.19,
      };
      const eastRegion = {
        swLat: 45.45,
        swLng: 9.185,
        neLat: 45.49,
        neLng: 9.23,
      };

      act(() => {
        result.current.setCache(westRegion, [], { zoom: 14, saturated: false });
        result.current.setCache(eastRegion, [], { zoom: 14, saturated: false });
      });

      const straddlingViewport = makeLatLngBounds({
        swLat: 45.46,
        swLng: 9.17,
        neLat: 45.48,
        neLng: 9.21,
      });
      expect(result.current.shouldFetch(straddlingViewport, 14)).toBe(false);

      const uncoveredCornerViewport = makeLatLngBounds({
        swLat: 45.46,
        swLng: 9.17,
        neLat: 45.50,
        neLng: 9.21,
      });
      expect(result.current.shouldFetch(uncoveredCornerViewport, 14)).toBe(true);
    });

    it("reports isSaturatedDrilldown only when region is saturated and zoom rises by >= 1.5", () => {
      const { result } = renderHook(() => useShopCache());
      const wideViewport = makeLatLngBounds({
        neLat: 45.50,
        neLng: 9.24,
        swLat: 45.44,
        swLng: 9.14,
      });
      const subViewport = makeLatLngBounds({
        neLat: 45.475,
        neLng: 9.195,
        swLat: 45.465,
        swLng: 9.185,
      });

      act(() => {
        result.current.setCache(expandBounds(wideViewport), [], { zoom: 13, saturated: true });
      });

      expect(result.current.isSaturatedDrilldown(subViewport, 14)).toBe(false);
      expect(result.current.isSaturatedDrilldown(subViewport, 15)).toBe(true);
    });
  });

  describe("mergeShopsById", () => {
    it("preserves existing shops while updating matching place_id entries without wiping prior pins", () => {
      const existing: KebabShop[] = [
        {
          place_id: "shop-1",
          name: "Old Istanbul",
          latitude: 45.46,
          longitude: 9.18,
          address: "Via A 1",
          data_source: "google",
        },
        {
          place_id: "shop-2",
          name: "Anatolia",
          latitude: 45.47,
          longitude: 9.19,
          address: "Via B 2",
          data_source: "cache",
        },
      ];

      const incoming: KebabShop[] = [
        {
          place_id: "shop-1",
          name: "Istanbul Doner Kebab (Updated)",
          latitude: 45.461,
          longitude: 9.181,
          address: "Via A 1, Milano",
          data_source: "google",
        },
        {
          place_id: "shop-3",
          name: "Marrakech Grill",
          latitude: 45.48,
          longitude: 9.20,
          address: "Via C 3",
          data_source: "google",
        },
      ];

      const merged = mergeShopsById(existing, incoming);

      // Must have exactly 3 shops: shop-1 (updated), shop-2 (preserved), shop-3 (added)
      expect(merged).toHaveLength(3);

      const shop1 = merged.find((s) => s.place_id === "shop-1");
      expect(shop1?.name).toBe("Istanbul Doner Kebab (Updated)");
      expect(shop1?.latitude).toBe(45.461);

      const shop2 = merged.find((s) => s.place_id === "shop-2");
      expect(shop2?.name).toBe("Anatolia");
      expect(shop2?.address).toBe("Via B 2");

      const shop3 = merged.find((s) => s.place_id === "shop-3");
      expect(shop3?.name).toBe("Marrakech Grill");
    });

    it("filters out invalid items without place_id", () => {
      const existing = [{ place_id: "shop-1" }] as KebabShop[];
      const incoming = [
        { place_id: "" } as unknown as KebabShop,
        { place_id: "shop-2" },
      ] as KebabShop[];

      const merged = mergeShopsById(existing, incoming);
      expect(merged).toHaveLength(2);
      expect(merged.map((s) => s.place_id)).toEqual(["shop-1", "shop-2"]);
    });
  });
});
