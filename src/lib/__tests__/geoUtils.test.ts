/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  estimateTravelTime,
  formatDistance,
  formatShopName,
  formatShopStreetAddress,
  formatTime,
  getGoogleMapsDeepLink,
} from "../geoUtils";

describe("calculateHaversineDistance", () => {
  it("should calculate the distance between two points correctly", () => {
    const p1 = { lat: 45.4642, lng: 9.19 }; // Milan
    const p2 = { lat: 41.9028, lng: 12.4964 }; // Rome
    const distance = calculateHaversineDistance(p1, p2);
    expect(distance).toBeGreaterThan(470);
    expect(distance).toBeLessThan(485);
  });

  it("should return 0 for the same point", () => {
    const p = { lat: 45.4642, lng: 9.19 };
    expect(calculateHaversineDistance(p, p)).toBe(0);
  });
});

describe("estimateTravelTime & formatTime & formatDistance", () => {
  it("estimates walking and driving time offline using tortuosity factors", () => {
    // 1 km walking: 1 * 1.3 / 5 * 60 = 15.6 -> 16 min
    expect(estimateTravelTime(1, "walking")).toBe(16);
    // 10 km driving: 10 * 1.4 / 30 * 60 = 28 min
    expect(estimateTravelTime(10, "driving")).toBe(28);
  });

  it("returns 0 minutes for zero or invalid distances", () => {
    expect(estimateTravelTime(0, "walking")).toBe(0);
    expect(estimateTravelTime(-5, "driving")).toBe(0);
    expect(estimateTravelTime(Number.NaN, "walking")).toBe(0);
  });

  it("formats minutes and distances cleanly", () => {
    expect(formatTime(15)).toBe("15 min");
    expect(formatTime(60)).toBe("1h");
    expect(formatTime(75)).toBe("1h 15m");
    expect(formatTime(-1)).toBe("--");

    expect(formatDistance(0.45)).toBe("450 m");
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(-1)).toBe("--");
  });
});

describe("getGoogleMapsDeepLink & formatShopName", () => {
  it("generates native Google Maps destination deep link", () => {
    expect(getGoogleMapsDeepLink(45.4642, 9.19)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=45.4642,9.19"
    );
  });

  it("formats shop name safely when missing", () => {
    expect(formatShopName({ name: "Istanbul Kebap" })).toBe("Istanbul Kebap");
    expect(formatShopName({ name: "   " })).toBe("Locale in aggiornamento");
    expect(formatShopName(undefined)).toBe("Locale in aggiornamento");
  });
});

describe("formatShopStreetAddress", () => {
  it("should extract the first part of a comma-separated address", () => {
    expect(formatShopStreetAddress({ address: "Via Roma, 12, 20121 Milano MI, Italy" })).toBe("Via Roma");
  });

  it("should fallback to city when address is missing or empty", () => {
    expect(formatShopStreetAddress({ address: null, city: "Milano" })).toBe("Milano");
    expect(formatShopStreetAddress({ address: "", city: "Roma" })).toBe("Roma");
  });

  it("should return semantic fallback when both address and city are missing or unknown", () => {
    expect(formatShopStreetAddress({ address: null, city: null })).toBe("Indirizzo in aggiornamento");
    expect(formatShopStreetAddress({ address: "", city: "Unknown" })).toBe("Indirizzo in aggiornamento");
    expect(formatShopStreetAddress(undefined)).toBe("Indirizzo in aggiornamento");
  });
});
