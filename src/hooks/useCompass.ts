"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GPS_CONSENT_EVENT, GPS_CONSENT_KEY, hasGpsConsent } from "./useGpsConsent";

/**
 * Hook to manage device orientation (Compass) for map orientation.
 * Uses direct DOM manipulation for high-performance (60fps) updates without React re-renders.
 * Never activates orientation sensors before explicit user GPS/compass consent.
 */
export function useCompass() {
  const compassRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const currentHeading = useRef<number>(0);
  const displayHeading = useRef<number>(0);
  const mapHeadingRef = useRef<number>(0);
  const hasReceivedOrientation = useRef<boolean>(false);
  const requestAnimationFrameId = useRef<number | null>(null);

  // Helper for shortest path angular interpolation (LERP) without wrapping
  const lerpAngle = useCallback((current: number, target: number, factor: number): number => {
    let diff = (target - current) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return current + diff * factor;
  }, []);

  const updateRotation = useCallback(() => {
    if (compassRef.current) {
      // Calculate target heading: device heading relative to map rotation
      const targetHeading = currentHeading.current - (mapHeadingRef.current || 0);
      
      // Smooth the rotation towards the target
      displayHeading.current = lerpAngle(displayHeading.current, targetHeading, 0.2);
      
      // Use direct DOM manipulation to bypass React's render cycle for 60fps performance.
      compassRef.current.style.transform = `rotate(${displayHeading.current}deg) translateZ(0)`;
      if (hasReceivedOrientation.current) {
        compassRef.current.style.opacity = "1";
      }
    }
    requestAnimationFrameId.current = requestAnimationFrame(updateRotation);
  }, [lerpAngle]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let heading = 0;
    let valid = false;

    // iOS: webkitCompassHeading is clockwise from North (0-360)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (event as any).webkitCompassHeading === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      heading = (event as any).webkitCompassHeading;
      valid = true;
    } 
    // Android / Standard: Calculate true compass heading from alpha, beta, gamma
    else if (event.alpha !== null && event.alpha !== undefined) {
      valid = true;
      const alpha = event.alpha || 0;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;

      if (beta === 0 && gamma === 0) {
        // Pure flat orientation (phone on horizontal plane)
        heading = (360 - alpha) % 360;
      } else {
        // 3D tilt-compensated compass calculation
        const radA = alpha * (Math.PI / 180);
        const radB = beta * (Math.PI / 180);
        const radG = gamma * (Math.PI / 180);

        const cA = Math.cos(radA);
        const sA = Math.sin(radA);
        const sB = Math.sin(radB);
        const cG = Math.cos(radG);
        const sG = Math.sin(radG);

        // Vector representing device top (Y-axis) projected on horizontal plane
        const vx = -sA * cG - cA * sB * sG;
        const vy = cA * cG - sA * sB * sG;

        let compassRad = Math.atan2(vx, vy);
        if (compassRad < 0) {
          compassRad += 2 * Math.PI;
        }
        heading = compassRad * (180 / Math.PI);
      }
    }

    if (valid) {
      hasReceivedOrientation.current = true;
      currentHeading.current = heading;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!hasGpsConsent()) {
      setIsPermissionGranted(false);
      return false;
    }

    // Handle iOS 13+ permission request requirement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOCE = (window as any).DeviceOrientationEvent;
    if (DOCE && typeof DOCE.requestPermission === "function") {
      try {
        const permission = await DOCE.requestPermission();
        if (permission === "granted") {
          setIsPermissionGranted(true);
          return true;
        }
      } catch (error) {
        console.error("Compass permission request failed:", error);
      }
    } else {
      // Android or desktop: still gated behind explicit GPS/Locate consent
      setIsPermissionGranted(true);
      return true;
    }
    return false;
  }, []);

  // Gate compass sensors on explicit GPS/compass consent and react to revocation.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOCE = (window as any).DeviceOrientationEvent;
    if (!DOCE) {
      setIsSupported(false);
      return;
    }

    const syncConsent = () => {
      if (!hasGpsConsent()) {
        hasReceivedOrientation.current = false;
        setIsPermissionGranted(false);
        return;
      }
      if (typeof DOCE.requestPermission !== "function") {
        // Non-iOS devices only activate once explicit GPS consent was granted.
        setIsPermissionGranted(true);
      }
    };

    syncConsent();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === GPS_CONSENT_KEY) syncConsent();
    };
    window.addEventListener(GPS_CONSENT_EVENT, syncConsent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GPS_CONSENT_EVENT, syncConsent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Start the animation loop and attach listeners when permission is granted or active
  useEffect(() => {
    if (!isPermissionGranted || typeof window === "undefined") return;

    requestAnimationFrameId.current = requestAnimationFrame(updateRotation);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const useAbsolute = "ondeviceorientationabsolute" in win;

    if (useAbsolute) {
      win.addEventListener("deviceorientationabsolute", handleOrientation, true);
    } else {
      win.addEventListener("deviceorientation", handleOrientation, true);
    }
    
    return () => {
      if (requestAnimationFrameId.current) {
        cancelAnimationFrame(requestAnimationFrameId.current);
      }
      if (useAbsolute) {
        win.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      } else {
        win.removeEventListener("deviceorientation", handleOrientation, true);
      }
    };
  }, [isPermissionGranted, handleOrientation, updateRotation]);

  return {
    compassRef,
    mapHeadingRef,
    isSupported,
    isPermissionGranted,
    requestPermission,
  };
}
