import React from "react";
import { render, screen, cleanup, fireEvent, act, renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { resetLocalDbAdapterForTests, upsertMapCacheEntries, getMapCacheEntries } from "@/lib/local-storage/db";
import { clearMemoryShopCache } from "@/hooks/useShopCache";
import { clearMapSession, useMapSession } from "@/hooks/useMapSession";
import { GPS_CONSENT_KEY, useGpsConsent } from "@/hooks/useGpsConsent";
import { MAPS_CONSENT_KEY, useMapConsent } from "@/hooks/useMapConsent";
import { serializeConsentChoice } from "@/lib/consent-storage";
import { useGeolocation } from "@/hooks/useGeolocation";
import MapConsentGate from "@/components/MapConsentGate";
import { GeoPermissionPrompt } from "@/components/map/GeoPermissionPrompt";
import KebabAdvancedMarker from "@/components/KebabAdvancedMarker";
import KebabMap from "@/components/KebabMap";

const mockMapListeners = new Map<string, Array<() => void>>();
const mockMapSetCenter = vi.fn();
const mockMapPanTo = vi.fn();
const mockMapSetZoom = vi.fn();
const mockMapMoveCamera = vi.fn();
let mockCurrentCenter = { lat: 45.4642, lng: 9.19 };
let mockCurrentZoom = 14;
let mockOnIdleProp: (() => void) | undefined;

const mockMapInstance = {
  getCenter: () => ({ lat: () => mockCurrentCenter.lat, lng: () => mockCurrentCenter.lng }),
  getZoom: () => mockCurrentZoom,
  getHeading: () => 0,
  getBounds: () => ({
    getNorthEast: () => ({
      lat: () => mockCurrentCenter.lat + 0.01,
      lng: () => mockCurrentCenter.lng + 0.01,
    }),
    getSouthWest: () => ({
      lat: () => mockCurrentCenter.lat - 0.01,
      lng: () => mockCurrentCenter.lng - 0.01,
    }),
  }),
  setCenter: (pos: { lat: number; lng: number }) => {
    mockMapSetCenter(pos);
    mockCurrentCenter = { ...pos };
  },
  panTo: (pos: { lat: number; lng: number }) => {
    mockMapPanTo(pos);
    mockCurrentCenter = { ...pos };
  },
  setZoom: (z: number) => {
    mockMapSetZoom(z);
    mockCurrentZoom = z;
  },
  moveCamera: (cam: { center?: { lat: number; lng: number }; zoom?: number }) => {
    mockMapMoveCamera(cam);
    if (cam.center) mockCurrentCenter = { ...cam.center };
    if (cam.zoom !== undefined) mockCurrentZoom = cam.zoom;
  },
  addListener: (ev: string, fn: () => void) => {
    const arr = mockMapListeners.get(ev) || [];
    arr.push(fn);
    mockMapListeners.set(ev, arr);
    return { remove: () => {} };
  },
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@react-google-maps/api", () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  GoogleMap: ({
    children,
    onLoad,
    onIdle,
  }: {
    children?: React.ReactNode;
    onLoad?: (map: unknown) => void;
    onIdle?: () => void;
  }) => {
    mockOnIdleProp = onIdle;
    React.useEffect(() => {
      onLoad?.(mockMapInstance);
    }, [onLoad]);
    return <div data-testid="mock-google-map">{children}</div>;
  },
  useGoogleMap: () => mockMapInstance,
}));

describe("Map anti-loop, marker hydration, scrollable consent popups & revocation", () => {
  const prevApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const prevTurnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const prevDisablePaid = process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
  const originalGeolocation = navigator.geolocation;

  beforeEach(async () => {
    vi.useFakeTimers();
    await resetLocalDbAdapterForTests();
    clearMemoryShopCache();
    clearMapSession();
    localStorage.clear();
    sessionStorage.clear();
    mockMapListeners.clear();
    mockMapSetCenter.mockClear();
    mockMapPanTo.mockClear();
    mockMapSetZoom.mockClear();
    mockMapMoveCamera.mockClear();
    mockCurrentCenter = { lat: 45.4642, lng: 9.19 };
    mockCurrentZoom = 14;
    mockOnIdleProp = undefined;
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyLiveTestKeyForLoopSpec";
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (prevApiKey === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = prevApiKey;
    }
    if (prevTurnstileKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevTurnstileKey;
    }
    if (prevDisablePaid === undefined) {
      delete process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
    } else {
      process.env.NEXT_PUBLIC_DISABLE_PAID_APIS = prevDisablePaid;
    }
    Object.defineProperty(navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
    delete (window as unknown as { google?: unknown }).google;
  });

  it("does NOT loop /api/shops when watchPosition fires repeatedly before user pan", async () => {
    localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("granted"));
    sessionStorage.setItem("kebapp_last_user_pos", JSON.stringify({ lat: 45.4642, lng: 9.19 }));

    let watchSuccessCb: ((pos: GeolocationPosition) => void) | null = null;
    const mockGeo = {
      getCurrentPosition: vi.fn((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 45.4642, longitude: 9.19 },
        } as GeolocationPosition);
      }),
      watchPosition: vi.fn((success: (pos: GeolocationPosition) => void) => {
        watchSuccessCb = success;
        return 1;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeo,
      configurable: true,
    });

    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: function MockMap() {},
        event: { trigger: vi.fn(), addListenerOnce: vi.fn() },
        marker: {
          AdvancedMarkerElement: class {
            addEventListener() {}
            removeEventListener() {}
            set map(_v: unknown) {}
          },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shops: [
          { place_id: "p1", name: null, latitude: 45.465, longitude: 9.191, data_source: "google" },
        ],
        source: "google",
        saturated: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    if (fetchMock.mock.calls.length === 0) {
      await act(async () => {
        mockOnIdleProp?.();
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const shopsCallsBefore = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("/api/shops")
    );
    expect(shopsCallsBefore).toHaveLength(1);

    // Simulate 5 noisy GPS watchPosition ticks + subsequent onIdle events
    for (let i = 1; i <= 5; i++) {
      await act(async () => {
        watchSuccessCb?.({
          coords: { latitude: 45.4642 + i * 0.0001, longitude: 9.19 + i * 0.0001 },
        } as GeolocationPosition);
        mockOnIdleProp?.();
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });
    }

    const shopsCallsAfter = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("/api/shops")
    );
    expect(shopsCallsAfter).toHaveLength(1);
  });

  it("does NOT refetch /api/shops on micro-pan within quantized 0.005° grid, and fetches when panning outside visible bounds", async () => {
    localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("denied"));
    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: function MockMap() {},
        event: { trigger: vi.fn(), addListenerOnce: vi.fn() },
        marker: {
          AdvancedMarkerElement: class {
            addEventListener() {}
            removeEventListener() {}
            set map(_v: unknown) {}
          },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shops: [
          { place_id: "p1", name: null, latitude: 45.465, longitude: 9.191, data_source: "google" },
        ],
        source: "google",
        saturated: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    if (fetchMock.mock.calls.length === 0) {
      await act(async () => {
        mockOnIdleProp?.();
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Small pan (+0.003 deg) stays inside the 0.005° quantized grid buffer -> no refetch
    mockCurrentCenter = { lat: 45.4642 + 0.003, lng: 9.19 + 0.003 };
    await act(async () => {
      mockOnIdleProp?.();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    const shopsCallsMicro = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("/api/shops")
    );
    expect(shopsCallsMicro).toHaveLength(1);

    // Large pan outside visible bounds (+0.025 deg) fetches new region (no 9x prefetch)
    mockCurrentCenter = { lat: 45.4642 + 0.025, lng: 9.19 + 0.025 };
    await act(async () => {
      mockOnIdleProp?.();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    const shopsCallsAfter = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("/api/shops")
    );
    expect(shopsCallsAfter).toHaveLength(2);
  });

  it("does NOT retry in loop on HTTP 429 or empty valid google response", async () => {
    localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("denied"));
    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: function MockMap() {},
        event: { trigger: vi.fn(), addListenerOnce: vi.fn() },
      },
    };

    // Case 1: Empty valid response caches region and stops
    const emptyFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shops: [], source: "google", saturated: false }),
    });
    vi.stubGlobal("fetch", emptyFetch);

    const { unmount } = render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(emptyFetch).toHaveBeenCalledTimes(1);

    // Subsequent idle on same bounds hits cache without network call
    await act(async () => {
      mockOnIdleProp?.();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(emptyFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Case 2: HTTP 429 cools down immediately without retry storm
    clearMemoryShopCache();
    const rateLimitedFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too Many Requests" }),
    });
    vi.stubGlobal("fetch", rateLimitedFetch);

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(rateLimitedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockOnIdleProp?.();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(rateLimitedFetch).toHaveBeenCalledTimes(1);
  });

  it("hydrates KebabAdvancedMarker asynchronously via google.maps.importLibrary('marker')", async () => {
    const createdInstances: Array<{ position: unknown }> = [];
    class AsyncMarker {
      position: unknown;
      constructor(opts: { position: unknown }) {
        this.position = opts.position;
        createdInstances.push({ position: opts.position });
      }
      addEventListener() {}
      removeEventListener() {}
      set map(_v: unknown) {}
    }

    const importLibraryMock = vi.fn(async (lib: string) => {
      if (lib === "marker") {
        return { AdvancedMarkerElement: AsyncMarker };
      }
      return {};
    });

    (window as unknown as { google: unknown }).google = {
      maps: {
        importLibrary: importLibraryMock,
      },
    };

    render(
      <KebabAdvancedMarker position={{ lat: 45.46, lng: 9.19 }}>
        <span>Pin</span>
      </KebabAdvancedMarker>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(importLibraryMock).toHaveBeenCalledWith("marker");
    expect(createdInstances).toHaveLength(1);
    expect(createdInstances[0].position).toEqual({ lat: 45.46, lng: 9.19 });
  });

  it("renders MapConsentGate (pending & denied) and GeoPermissionPrompt with scrollable containers and portal accessibility", () => {
    // Pending state
    const { unmount: unmountPending } = render(
      <MapConsentGate>
        <div>Mappa Segreta</div>
      </MapConsentGate>
    );
    expect(screen.queryByText("Mappa Segreta")).not.toBeInTheDocument();
    const consentRegion = screen.getByRole("region", { name: "Consenso Google Maps" });
    expect(consentRegion.className).toContain("overflow-y-auto");
    expect(consentRegion.className).toContain("app-scroll");
    expect(consentRegion.firstElementChild?.className).toContain("my-auto");
    unmountPending();

    // Denied state
    localStorage.setItem("kebapp_maps_consent", serializeConsentChoice("denied"));
    const { unmount: unmountDenied } = render(
      <MapConsentGate>
        <div>Mappa Segreta</div>
      </MapConsentGate>
    );
    const deniedHeading = screen.getByText("Mappa Google Non Attiva");
    const deniedCard = deniedHeading.closest("div.my-auto");
    expect(deniedCard).not.toBeNull();
    expect(deniedCard?.parentElement?.className).toContain("overflow-y-auto");
    expect(deniedCard?.parentElement?.className).toContain("app-scroll");
    unmountDenied();

    // GeoPermissionPrompt rendered in portal with scroll, no overflow-hidden on card, Escape dismiss
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <div className="pointer-events-none">
        <GeoPermissionPrompt onAccept={onAccept} onDecline={onDecline} />
      </div>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain("overflow-y-auto");
    expect(dialog.className).toContain("app-scroll");
    expect(dialog.className).toContain("pointer-events-auto");
    const innerCard = dialog.firstElementChild as HTMLElement;
    expect(innerCard.className).toContain("my-auto");
    expect(innerCard.className).not.toContain("overflow-hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("revokes Maps and GPS consents completely: clears caches, mapSession, sessionStorage, watches, and in-flight fixes", async () => {
    await upsertMapCacheEntries([{ place_id: "cached_1", latitude: 45.46, longitude: 9.19 }]);
    expect(await getMapCacheEntries()).toHaveLength(1);

    localStorage.setItem(MAPS_CONSENT_KEY, serializeConsentChoice("granted"));
    localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("granted"));
    sessionStorage.setItem("kebapp_last_user_pos", JSON.stringify({ lat: 45.46, lng: 9.19 }));

    let pendingGeoCallback: ((pos: GeolocationPosition) => void) | null = null;
    const clearWatchMock = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: vi.fn((cb: (pos: GeolocationPosition) => void) => {
          pendingGeoCallback = cb;
        }),
        watchPosition: vi.fn(() => 42),
        clearWatch: clearWatchMock,
      },
      configurable: true,
    });

    const sessionHook = renderHook(() => useMapSession());
    act(() => {
      sessionHook.result.current.save({ lat: 45.46, lng: 9.19 }, 15);
    });
    expect(sessionHook.result.current.get().center).toEqual({ lat: 45.46, lng: 9.19 });

    const mapsHook = renderHook(() => useMapConsent());
    const gpsHook = renderHook(() => useGpsConsent());
    const geoHook = renderHook(() => useGeolocation());

    expect(geoHook.result.current.position).toEqual({ lat: 45.46, lng: 9.19 });

    // Revoke Maps consent -> clears map_cache + mapSession
    await act(async () => {
      mapsHook.result.current.denyConsent();
      await Promise.resolve();
    });
    expect(mapsHook.result.current.status).toBe("denied");
    expect(await getMapCacheEntries()).toHaveLength(0);
    expect(sessionHook.result.current.get().center).toBeNull();

    // Save session again then revoke GPS consent -> clears sessionStorage, mapSession, watch, and geo position
    act(() => {
      sessionHook.result.current.save({ lat: 45.47, lng: 9.2 }, 15);
      gpsHook.result.current.denyGpsConsent();
    });

    expect(gpsHook.result.current.status).toBe("denied");
    expect(sessionStorage.getItem("kebapp_last_user_pos")).toBeNull();
    expect(sessionHook.result.current.get().center).toBeNull();
    expect(geoHook.result.current.position).toBeNull();
    expect(clearWatchMock).toHaveBeenCalledWith(42);

    // Late in-flight geolocation callback must NOT restore sessionStorage or position after revocation
    act(() => {
      pendingGeoCallback?.({
        coords: { latitude: 41.9, longitude: 12.5 },
      } as GeolocationPosition);
    });
    expect(sessionStorage.getItem("kebapp_last_user_pos")).toBeNull();
    expect(geoHook.result.current.position).toBeNull();

    // Cross-tab revocation via StorageEvent also clears sessionStorage & mapSession
    act(() => {
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("granted"));
      window.dispatchEvent(new StorageEvent("storage", { key: GPS_CONSENT_KEY }));
      sessionStorage.setItem("kebapp_last_user_pos", JSON.stringify({ lat: 44.5, lng: 11.3 }));
      sessionHook.result.current.save({ lat: 44.5, lng: 11.3 }, 14);
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("denied"));
      window.dispatchEvent(new StorageEvent("storage", { key: GPS_CONSENT_KEY }));
    });
    expect(sessionStorage.getItem("kebapp_last_user_pos")).toBeNull();
    expect(sessionHook.result.current.get().center).toBeNull();
  });

  it("invalidates legacy string, mismatched policyVersion, and expired (>180 days) consents", () => {
    localStorage.setItem(MAPS_CONSENT_KEY, "granted");
    const legacyHook = renderHook(() => useMapConsent());
    expect(legacyHook.result.current.status).toBe("pending");
    expect(localStorage.getItem(MAPS_CONSENT_KEY)).toBeNull();
    legacyHook.unmount();

    localStorage.setItem(
      GPS_CONSENT_KEY,
      serializeConsentChoice("granted", Date.now(), "1.0")
    );
    const oldVersionHook = renderHook(() => useGpsConsent());
    expect(oldVersionHook.result.current.status).toBe("pending");
    expect(localStorage.getItem(GPS_CONSENT_KEY)).toBeNull();
    oldVersionHook.unmount();

    const expiredRecord = serializeConsentChoice("granted", Date.now() - 200 * 24 * 60 * 60 * 1000);
    localStorage.setItem(MAPS_CONSENT_KEY, expiredRecord);
    const expiredHook = renderHook(() => useMapConsent());
    expect(expiredHook.result.current.status).toBe("pending");
    expect(localStorage.getItem(MAPS_CONSENT_KEY)).toBeNull();
  });

  it("bypasses MapConsentGate in Zero-Cost mode without storing kebapp_maps_consent", () => {
    process.env.NEXT_PUBLIC_DISABLE_PAID_APIS = "1";
    render(
      <MapConsentGate>
        <div>Vista Zero-Cost Diretta</div>
      </MapConsentGate>
    );
    expect(screen.getByText("Vista Zero-Cost Diretta")).toBeInTheDocument();
    expect(localStorage.getItem(MAPS_CONSENT_KEY)).toBeNull();
  });
});
