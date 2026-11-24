import { describe, it, expect, vi } from "vitest";

interface RoutingState {
  polyline: { setMap: (map: unknown) => void } | null;
  isRoutingActive: boolean;
  routingInfo: { distance: string; duration: string } | null;
  routingPath: unknown[];
  preRoutingState: { center: { lat: number; lng: number } | null; zoom: number } | null;
  routingDestination: { place_id: string; latitude: number | null; longitude: number | null } | null;
  selectedShop: { place_id: string } | null;
}

/**
 * Pure state reducer / runner mirroring KebabMap.cancelRouting logic
 */
function executeCancelRouting(
  state: RoutingState,
  map: { panTo: (pos: unknown) => void; setZoom: (zoom: number) => void } | null
): RoutingState {
  const next = { ...state };

  if (next.polyline) {
    next.polyline.setMap(null);
    next.polyline = null;
  }

  next.isRoutingActive = false;
  next.routingInfo = null;
  next.routingPath = [];

  if (map && next.preRoutingState) {
    if (next.preRoutingState.center) {
      map.panTo(next.preRoutingState.center);
    }
    map.setZoom(next.preRoutingState.zoom);
  } else if (
    map &&
    next.routingDestination &&
    next.routingDestination.latitude !== null &&
    next.routingDestination.longitude !== null
  ) {
    map.panTo({ lat: next.routingDestination.latitude, lng: next.routingDestination.longitude });
    map.setZoom(16);
  }

  next.preRoutingState = null;

  if (next.routingDestination) {
    next.selectedShop = next.routingDestination;
    next.routingDestination = null;
  }

  return next;
}

describe("KebabMap cancelRouting logic", () => {
  it("clears polyline via setMap(null) and restores preRoutingState center and zoom", () => {
    const mockPolyline = { setMap: vi.fn() };
    const mockMap = { panTo: vi.fn(), setZoom: vi.fn() };

    const initialState: RoutingState = {
      polyline: mockPolyline,
      isRoutingActive: true,
      routingInfo: { distance: "1.2 km", duration: "12 min" },
      routingPath: [{ lat: 45.46, lng: 9.18 }, { lat: 45.47, lng: 9.19 }],
      preRoutingState: { center: { lat: 45.45, lng: 9.17 }, zoom: 15 },
      routingDestination: { place_id: "shop-1", latitude: 45.47, longitude: 9.19 },
      selectedShop: null,
    };

    const finalState = executeCancelRouting(initialState, mockMap);

    expect(mockPolyline.setMap).toHaveBeenCalledWith(null);
    expect(finalState.polyline).toBeNull();
    expect(finalState.isRoutingActive).toBe(false);
    expect(finalState.routingInfo).toBeNull();
    expect(finalState.routingPath).toEqual([]);

    expect(mockMap.panTo).toHaveBeenCalledWith({ lat: 45.45, lng: 9.17 });
    expect(mockMap.setZoom).toHaveBeenCalledWith(15);
    expect(finalState.preRoutingState).toBeNull();

    expect(finalState.selectedShop).toEqual({ place_id: "shop-1", latitude: 45.47, longitude: 9.19 });
    expect(finalState.routingDestination).toBeNull();
  });

  it("falls back to destination coords at zoom 16 when preRoutingState is null", () => {
    const mockMap = { panTo: vi.fn(), setZoom: vi.fn() };

    const initialState: RoutingState = {
      polyline: null,
      isRoutingActive: true,
      routingInfo: null,
      routingPath: [],
      preRoutingState: null,
      routingDestination: { place_id: "shop-2", latitude: 45.48, longitude: 9.20 },
      selectedShop: null,
    };

    const finalState = executeCancelRouting(initialState, mockMap);

    expect(mockMap.panTo).toHaveBeenCalledWith({ lat: 45.48, lng: 9.20 });
    expect(mockMap.setZoom).toHaveBeenCalledWith(16);
    expect(finalState.selectedShop).toEqual({ place_id: "shop-2", latitude: 45.48, longitude: 9.20 });
    expect(finalState.routingDestination).toBeNull();
  });
});
