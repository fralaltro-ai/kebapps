import { describe, it, expect } from "vitest";
import {
  parseInAppBrowser,
  parsePlatform,
  isStandaloneFrom,
  isSnoozed,
  computeSnoozeUntil,
  PWA_SNOOZE_MS,
} from "../pwa-utils";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
  ipadTouch:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  pixelChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 musical_ly_2024.1.0",
  telegramAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Telegram-Android/11.0.0",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

describe("pwa-utils", () => {
  describe("parseInAppBrowser", () => {
    it("detects Instagram", () => {
      expect(parseInAppBrowser(UA.instagramIos)).toBe("instagram");
    });
    it("detects TikTok", () => {
      expect(parseInAppBrowser(UA.tiktokAndroid)).toBe("tiktok");
    });
    it("detects Telegram", () => {
      expect(parseInAppBrowser(UA.telegramAndroid)).toBe("telegram");
    });
    it("returns null for regular browsers", () => {
      expect(parseInAppBrowser(UA.pixelChrome)).toBeNull();
      expect(parseInAppBrowser(UA.iphoneSafari)).toBeNull();
      expect(parseInAppBrowser(UA.desktopChrome)).toBeNull();
    });
    it("returns null for an empty UA string", () => {
      expect(parseInAppBrowser("")).toBeNull();
    });
  });

  describe("parsePlatform", () => {
    it("classifies iPhone Safari as ios-safari", () => {
      expect(parsePlatform(UA.iphoneSafari, {})).toBe("ios-safari");
    });
    it("classifies iPhone Chrome (CriOS) as ios-other", () => {
      expect(parsePlatform(UA.iphoneChrome, {})).toBe("ios-other");
    });
    it("classifies an in-app iOS browser as ios-other even with Safari UA tokens", () => {
      expect(parsePlatform(UA.instagramIos, {})).toBe("ios-other");
    });
    it("classifies iPad reporting as MacIntel with touch points as iOS", () => {
      expect(
        parsePlatform(UA.ipadTouch, { platform: "MacIntel", maxTouchPoints: 5 })
      ).toBe("ios-safari");
    });
    it("does not misclassify a real Mac (no touch points) as iOS", () => {
      expect(
        parsePlatform(UA.desktopChrome, { platform: "MacIntel", maxTouchPoints: 0 })
      ).toBe("desktop");
    });
    it("classifies Pixel Chrome as android-chrome", () => {
      expect(parsePlatform(UA.pixelChrome, {})).toBe("android-chrome");
    });
    it("classifies Samsung Internet as android-other", () => {
      expect(parsePlatform(UA.samsungInternet, {})).toBe("android-other");
    });
    it("classifies desktop Chrome as desktop", () => {
      expect(parsePlatform(UA.desktopChrome, {})).toBe("desktop");
    });
  });

  describe("isStandaloneFrom", () => {
    const base = { displayModeStandalone: false, referrer: "", search: "" };

    it("is true when display-mode: standalone matches", () => {
      expect(isStandaloneFrom({ ...base, displayModeStandalone: true })).toBe(true);
    });
    it("is true for iOS legacy navigator.standalone", () => {
      expect(isStandaloneFrom({ ...base, navStandalone: true })).toBe(true);
    });
    it("is true when launched from a TWA (android-app referrer)", () => {
      expect(
        isStandaloneFrom({ ...base, referrer: "android-app://com.kebapps.twa" })
      ).toBe(true);
    });
    it("is true with a utm_source=playstore launch param", () => {
      expect(isStandaloneFrom({ ...base, search: "?utm_source=playstore" })).toBe(true);
    });
    it("is true with a mode=twa launch param", () => {
      expect(isStandaloneFrom({ ...base, search: "?ref=x&mode=twa" })).toBe(true);
    });
    it("is false for an ordinary browser tab", () => {
      expect(isStandaloneFrom(base)).toBe(false);
      expect(isStandaloneFrom({ ...base, navStandalone: false })).toBe(false);
      expect(isStandaloneFrom({ ...base, referrer: "https://google.com" })).toBe(false);
    });
  });

  describe("isSnoozed / computeSnoozeUntil", () => {
    const now = 1_700_000_000_000;

    it("is false when no value is stored", () => {
      expect(isSnoozed(null, now)).toBe(false);
    });
    it("is false when the value is not a finite number", () => {
      expect(isSnoozed("not-a-number", now)).toBe(false);
    });
    it("is true for a future snooze timestamp", () => {
      expect(isSnoozed(String(now + 1000), now)).toBe(true);
    });
    it("is false for an expired snooze timestamp", () => {
      expect(isSnoozed(String(now - 1000), now)).toBe(false);
    });
    it("computeSnoozeUntil adds exactly 7 days", () => {
      expect(computeSnoozeUntil(now)).toBe(now + PWA_SNOOZE_MS);
      expect(PWA_SNOOZE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
