/**
 * pwa-utils.ts
 *
 * Single source of truth for PWA environment detection (standalone/TWA,
 * in-app browsers, platform) and the onboarding/install-prompt state
 * machine (localStorage/sessionStorage flags, snooze window).
 *
 * Pure parsing functions take explicit inputs and are exported separately
 * from their DOM-reading wrappers so they can be unit tested without jsdom.
 */

export const PWA_KEYS = {
  ONBOARDING_SEEN: "kebapp_onboarding_seen",
  SESSIONS: "kebapp_sessions",
  DISMISSED_UNTIL: "kebapp_pwa_dismissed_until",
} as const;

/** sessionStorage guard so `kebapp_sessions` increments once per tab, not per navigation. */
export const SESSION_COUNTED_KEY = "kebapp_session_counted";

export const PWA_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum completed sessions (post-onboarding) before the install prompt is allowed to appear. */
export const PWA_MIN_SESSIONS = 2;

export type InAppApp =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "telegram"
  | "twitter"
  | "linkedin"
  | "snapchat";

export type PwaPlatform =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "desktop";

export interface PlatformInfo {
  platform: PwaPlatform;
  inApp: InAppApp | null;
  /** True only when the native `beforeinstallprompt` flow is realistically usable. */
  canUseNativePrompt: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure parsing helpers (unit-testable without a DOM)                          */
/* -------------------------------------------------------------------------- */

/** Detects known in-app WebView browsers (Instagram, TikTok, Telegram, ...) from a User-Agent string. */
export function parseInAppBrowser(ua: string): InAppApp | null {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/TikTok|BytedanceWebview|musical_ly/i.test(ua)) return "tiktok";
  if (/Telegram|TelegramBot/i.test(ua)) return "telegram";
  if (/Twitter/i.test(ua)) return "twitter";
  if (/LinkedInApp/i.test(ua)) return "linkedin";
  if (/Snapchat/i.test(ua)) return "snapchat";
  return null;
}

/** Classifies OS/browser into the platform buckets the install prompt cares about. */
export function parsePlatform(
  ua: string,
  nav: { platform?: string; maxTouchPoints?: number }
): PwaPlatform {
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);

  if (isIos) {
    // iOS browsers are all Safari/WebKit under the hood; only Safari itself
    // exposes the "Add to Home Screen" share-sheet flow we can guide users to.
    const isNonSafariIos = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua);
    const inApp = parseInAppBrowser(ua);
    return isNonSafariIos || inApp ? "ios-other" : "ios-safari";
  }

  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    const isChrome =
      /Chrome/i.test(ua) && !/SamsungBrowser|Edg|OPR|Firefox|YaBrowser/i.test(ua);
    return isChrome ? "android-chrome" : "android-other";
  }

  return "desktop";
}

export interface StandaloneSignals {
  displayModeStandalone: boolean;
  navStandalone?: boolean;
  referrer: string;
  search: string;
}

/** True when running installed: PWA standalone display-mode, iOS legacy standalone, or launched as a TWA from Play Store. */
export function isStandaloneFrom(input: StandaloneSignals): boolean {
  if (input.displayModeStandalone) return true;
  if (input.navStandalone === true) return true;
  if (input.referrer.startsWith("android-app://")) return true;
  if (/(?:^|[?&])(?:mode=twa|utm_source=playstore)(?:&|$)/.test(input.search)) return true;
  return false;
}

/** True when `raw` (an ISO/epoch-ms string from localStorage) is a still-active snooze timestamp. */
export function isSnoozed(raw: string | null, now: number): boolean {
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  return until > now;
}

export function computeSnoozeUntil(now: number): number {
  return now + PWA_SNOOZE_MS;
}

/* -------------------------------------------------------------------------- */
/* DOM-reading wrappers                                                        */
/* -------------------------------------------------------------------------- */

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Safari private mode / storage disabled — degrade silently.
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return isStandaloneFrom({
    displayModeStandalone: window.matchMedia?.("(display-mode: standalone)").matches === true,
    navStandalone,
    referrer: document.referrer || "",
    search: window.location.search || "",
  });
}

export function getPlatformInfo(): PlatformInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "desktop", inApp: null, canUseNativePrompt: false };
  }
  const ua = navigator.userAgent;
  const platform = parsePlatform(ua, {
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const inApp = parseInAppBrowser(ua);
  return {
    platform,
    inApp,
    canUseNativePrompt: platform === "android-chrome" && inApp === null,
  };
}

export function isPwaSnoozed(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  return isSnoozed(safeGetItem(window.localStorage, PWA_KEYS.DISMISSED_UNTIL), now);
}

export function snoozePwaPrompt(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  safeSetItem(window.localStorage, PWA_KEYS.DISMISSED_UNTIL, String(computeSnoozeUntil(now)));
}

/**
 * Increments the persistent session counter at most once per browser tab
 * (guarded via sessionStorage) so client-side navigations within the same
 * tab don't inflate it, and returns the up-to-date count.
 */
export function registerSession(): number {
  if (typeof window === "undefined") return 0;
  const current = parseInt(safeGetItem(window.localStorage, PWA_KEYS.SESSIONS) || "0", 10);

  let alreadyCounted = false;
  try {
    alreadyCounted = window.sessionStorage.getItem(SESSION_COUNTED_KEY) === "true";
  } catch {
    alreadyCounted = false;
  }

  if (alreadyCounted) return current;

  const next = current + 1;
  safeSetItem(window.localStorage, PWA_KEYS.SESSIONS, String(next));
  try {
    window.sessionStorage.setItem(SESSION_COUNTED_KEY, "true");
  } catch {
    // ignore
  }
  return next;
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return safeGetItem(window.localStorage, PWA_KEYS.ONBOARDING_SEEN) === "true";
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  safeSetItem(window.localStorage, PWA_KEYS.ONBOARDING_SEEN, "true");
}

/* -------------------------------------------------------------------------- */
/* beforeinstallprompt bridge                                                  */
/* -------------------------------------------------------------------------- */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __kebappDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Reads the `beforeinstallprompt` event captured by the inline bootstrap script in layout.tsx. */
export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__kebappDeferredPrompt ?? null;
}

export function clearDeferredPrompt(): void {
  if (typeof window === "undefined") return;
  window.__kebappDeferredPrompt = null;
}
