import { GPS_CONSENT_EVENT, GPS_CONSENT_KEY } from "@/hooks/useGpsConsent";
import { MAPS_CONSENT_EVENT, MAPS_CONSENT_KEY } from "@/hooks/useMapConsent";
import { clearMapCache } from "@/lib/local-storage/db";
import { clearMemoryShopCache } from "@/hooks/useShopCache";
import { clearMapSession } from "@/hooks/useMapSession";
import { PWA_KEYS, SESSION_COUNTED_KEY } from "@/lib/pwa-utils";

/**
 * Browser-stored personal keys and flags cleared on explicit user reset.
 * Theme preference is a device setting and is deliberately kept.
 */
const PERSONAL_LOCAL_KEYS = [
  GPS_CONSENT_KEY,
  MAPS_CONSENT_KEY,
  PWA_KEYS.ONBOARDING_SEEN,
  PWA_KEYS.SESSIONS,
  PWA_KEYS.DISMISSED_UNTIL,
];

const PERSONAL_SESSION_KEYS = [
  "kebapp_last_user_pos",
  SESSION_COUNTED_KEY,
];

function purgeServiceWorkerRuntimeCaches(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.controller?.postMessage({ type: "KEBAPPS_PURGE_PRIVATE_CACHES" });
    void navigator.serviceWorker
      .getRegistration?.()
      .then((reg) => {
        reg?.active?.postMessage({ type: "KEBAPPS_PURGE_PRIVATE_CACHES" });
      })
      .catch(() => {
        // ignore unsupported registration lookup
      });
  } catch {
    // ignore SW unavailable
  }
}

export function clearLocalUserState(): void {
  if (typeof window === "undefined") return;
  for (const key of PERSONAL_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage unavailable (private mode, blocked site data): nothing to clear
    }
  }
  for (const key of PERSONAL_SESSION_KEYS) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // storage unavailable
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(GPS_CONSENT_EVENT));
    window.dispatchEvent(new CustomEvent(MAPS_CONSENT_EVENT));
  } catch {
    // ignore environments without CustomEvent dispatch support
  }
  clearMapSession();
  clearMemoryShopCache();
  purgeServiceWorkerRuntimeCaches();
  void clearMapCache().catch(() => {
    // ignore IndexedDB unavailable
  });
}

export async function resetAllLocalData(): Promise<void> {
  const { resetAllLocalData: resetLocalDbAndPreferences } = await import(
    "@/lib/local-storage/backup"
  );
  await resetLocalDbAndPreferences();
}
