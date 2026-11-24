"use client";

import { useState, useCallback, useEffect } from "react";
import { clearMapCache } from "@/lib/local-storage/db";
import { clearMemoryShopCache } from "@/hooks/useShopCache";
import { clearMapSession } from "@/hooks/useMapSession";
import {
  readStoredConsentChoice,
  serializeConsentChoice,
} from "@/lib/consent-storage";

export const MAPS_CONSENT_KEY = "kebapp_maps_consent";
export const MAPS_CONSENT_EVENT = "kebapp_maps_consent_change";

export type ConsentStatus = "checking" | "granted" | "denied" | "pending";

function readCurrentStatus(): ConsentStatus {
  if (typeof window === "undefined") return "checking";
  return readStoredConsentChoice(window.localStorage, MAPS_CONSENT_KEY);
}

export function useMapConsent() {
  const [status, setStatus] = useState<ConsentStatus>("checking");

  const syncStatus = useCallback(() => {
    setStatus(readCurrentStatus());
  }, []);

  useEffect(() => {
    syncStatus();

    const handleCustomChange = () => syncStatus();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MAPS_CONSENT_KEY) {
        syncStatus();
      }
    };

    window.addEventListener(MAPS_CONSENT_EVENT, handleCustomChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(MAPS_CONSENT_EVENT, handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncStatus]);

  const notifyChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(MAPS_CONSENT_EVENT));
    }
  };

  const grantConsent = useCallback(() => {
    try {
      localStorage.setItem(MAPS_CONSENT_KEY, serializeConsentChoice("granted"));
    } catch (e) {
      console.error("Errore nel salvataggio del consenso Maps:", e);
    }
    setStatus("granted");
    notifyChange();
  }, []);

  const denyConsent = useCallback(() => {
    try {
      localStorage.setItem(MAPS_CONSENT_KEY, serializeConsentChoice("denied"));
    } catch (e) {
      console.error("Errore nel salvataggio del rifiuto Maps:", e);
    }
    clearMapSession();
    clearMemoryShopCache();
    void clearMapCache().catch(() => {
      // ignore IndexedDB unavailable
    });
    setStatus("denied");
    notifyChange();
  }, []);

  const resetConsent = useCallback(() => {
    try {
      localStorage.removeItem(MAPS_CONSENT_KEY);
    } catch (e) {
      console.error("Errore nel reset del consenso Maps:", e);
    }
    clearMapSession();
    clearMemoryShopCache();
    void clearMapCache().catch(() => {
      // ignore IndexedDB unavailable
    });
    setStatus("pending");
    notifyChange();
  }, []);

  return { status, grantConsent, denyConsent, resetConsent };
}

