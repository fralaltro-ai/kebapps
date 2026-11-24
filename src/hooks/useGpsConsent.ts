"use client";

import { useState, useCallback, useEffect } from "react";
import { clearMapSession } from "@/hooks/useMapSession";
import {
  readStoredConsentChoice,
  serializeConsentChoice,
} from "@/lib/consent-storage";

export const GPS_CONSENT_KEY = "kebapp_gps_consent";
export const GPS_CONSENT_EVENT = "kebapp_gps_consent_change";
const LAST_POS_KEY = "kebapp_last_user_pos";

export type GpsConsentStatus = "checking" | "granted" | "denied" | "pending";

export function readGpsConsentStatus(): GpsConsentStatus {
  return readCurrentStatus();
}

export function hasGpsConsent(): boolean {
  return readCurrentStatus() === "granted";
}

function readCurrentStatus(): GpsConsentStatus {
  if (typeof window === "undefined") return "checking";
  return readStoredConsentChoice(window.localStorage, GPS_CONSENT_KEY);
}

export function useGpsConsent() {
  const [status, setStatus] = useState<GpsConsentStatus>("checking");

  const syncStatus = useCallback(() => {
    const next = readCurrentStatus();
    if (next === "denied" || next === "pending") {
      try {
        sessionStorage.removeItem(LAST_POS_KEY);
      } catch {
        // ignore storage unavailable
      }
      clearMapSession();
    }
    setStatus(next);
  }, []);

  useEffect(() => {
    syncStatus();

    const handleCustomChange = () => syncStatus();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === GPS_CONSENT_KEY) {
        syncStatus();
      }
    };

    window.addEventListener(GPS_CONSENT_EVENT, handleCustomChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GPS_CONSENT_EVENT, handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncStatus]);

  const notifyChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GPS_CONSENT_EVENT));
    }
  };

  const grantGpsConsent = useCallback(() => {
    try {
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("granted"));
    } catch (e) {
      console.error("Errore nel salvataggio del consenso GPS:", e);
    }
    setStatus("granted");
    notifyChange();
  }, []);

  const denyGpsConsent = useCallback(() => {
    try {
      localStorage.setItem(GPS_CONSENT_KEY, serializeConsentChoice("denied"));
      sessionStorage.removeItem(LAST_POS_KEY);
    } catch (e) {
      console.error("Errore nel salvataggio del rifiuto GPS:", e);
    }
    clearMapSession();
    setStatus("denied");
    notifyChange();
  }, []);

  const resetGpsConsent = useCallback(() => {
    try {
      localStorage.removeItem(GPS_CONSENT_KEY);
      sessionStorage.removeItem(LAST_POS_KEY);
    } catch (e) {
      console.error("Errore nel reset del consenso GPS:", e);
    }
    clearMapSession();
    setStatus("pending");
    notifyChange();
  }, []);

  return { status, grantGpsConsent, denyGpsConsent, resetGpsConsent };
}
