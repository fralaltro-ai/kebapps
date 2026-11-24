"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasGpsConsent, useGpsConsent } from "./useGpsConsent";

const LAST_POS_KEY = "kebapp_last_user_pos";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

function readCachedPosition(): LatLngLiteral | null {
  if (typeof window === "undefined" || !hasGpsConsent()) return null;
  try {
    const cachedSession = sessionStorage.getItem(LAST_POS_KEY);
    if (cachedSession) {
      const parsed = JSON.parse(cachedSession);
      if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCachedPosition(pos: LatLngLiteral) {
  if (!hasGpsConsent()) return;
  try {
    sessionStorage.setItem(LAST_POS_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

/**
 * Hook di geolocalizzazione riusabile, zero-cost (solo API HTML5 native del
 * browser, nessuna chiamata a pagamento). Riusa la stessa cache di posizione
 * (sessionStorage, chiave "kebapp_last_user_pos") già usata da KebabMap.tsx,
 * così la mappa e il Kebab dei Desideri condividono l'ultima posizione nota
 * senza richiedere un nuovo permesso GPS entro la stessa sessione di navigazione.
 *
 * COMP-AUDIT-D1: deliberatamente solo sessionStorage, mai localStorage —
 * `docs/COOKIE_POLICY.md` dichiara questa cache come cancellata alla chiusura
 * della scheda, e la posizione dell'utente non deve sopravvivere oltre la
 * sessione di navigazione corrente.
 *
 * Nessuna coordinata viene mai inviata al server o persistita lato database:
 * resta interamente lato client, coerentemente con la Zero-Cost Policy e con
 * l'architettura local-first del progetto.
 */
export function useGeolocation() {
  const { status: consentStatus } = useGpsConsent();
  const [position, setPosition] = useState<LatLngLiteral | null>(() => readCachedPosition());
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    if (!hasGpsConsent()) return;
    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    writeCachedPosition(next);
    setPosition(next);
    setError(null);
    setIsLocating(false);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(err.message || "Impossibile ottenere la posizione.");
    setIsLocating(false);
  }, []);

  const requestPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocalizzazione non supportata dal tuo browser.");
      return;
    }
    if (!hasGpsConsent()) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
  }, [handleSuccess, handleError]);

  useEffect(() => {
    if (consentStatus !== "granted") {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (consentStatus === "denied" || consentStatus === "pending") {
        setPosition(null);
        setIsLocating(false);
        setError(null);
      }
      return;
    }

    requestPosition();

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000,
      });
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentStatus]);

  return { position, error, isLocating, consentStatus, requestPosition };
}
