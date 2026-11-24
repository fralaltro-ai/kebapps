import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCompass } from "@/hooks/useCompass";
import { GPS_CONSENT_EVENT, GPS_CONSENT_KEY } from "@/hooks/useGpsConsent";
import { serializeConsentChoice } from "@/lib/consent-storage";

describe("useCompass consent gating", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Simulate Android/Desktop DeviceOrientationEvent (no requestPermission method)
    (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent = function () {};
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
  });

  it("does NOT attach orientation listeners before explicit GPS consent on non-iOS browsers", () => {
    const { result } = renderHook(() => useCompass());
    expect(result.current.isPermissionGranted).toBe(false);

    const orientationAdds = addSpy.mock.calls.filter(
      ([ev]: [string, ...unknown[]]) => ev === "deviceorientation" || ev === "deviceorientationabsolute"
    );
    expect(orientationAdds).toHaveLength(0);
  });

  it("attaches orientation listeners on consent grant and detaches immediately on consent revocation", () => {
    const { result } = renderHook(() => useCompass());
    expect(result.current.isPermissionGranted).toBe(false);

    act(() => {
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("granted"));
      window.dispatchEvent(new CustomEvent(GPS_CONSENT_EVENT));
    });

    expect(result.current.isPermissionGranted).toBe(true);
    const orientationAdds = addSpy.mock.calls.filter(
      ([ev]: [string, ...unknown[]]) => ev === "deviceorientation" || ev === "deviceorientationabsolute"
    );
    expect(orientationAdds).toHaveLength(1);

    act(() => {
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("denied"));
      window.dispatchEvent(new CustomEvent(GPS_CONSENT_EVENT));
    });

    expect(result.current.isPermissionGranted).toBe(false);
    const orientationRemovals = removeSpy.mock.calls.filter(
      ([ev]: [string, ...unknown[]]) => ev === "deviceorientation" || ev === "deviceorientationabsolute"
    );
    expect(orientationRemovals).toHaveLength(1);
  });
});
