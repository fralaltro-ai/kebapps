import { describe, expect, it } from "vitest";
import {
  calculateKebabIndex,
  computePersonalGamification,
  DiaryStatInput,
  GAMIFICATION_LEVELS,
  resolveLevelForXp,
  XP_PER_DIARY_ENTRY,
  XP_PER_UNIQUE_CITY,
  XP_PER_UNIQUE_COUNTRY,
} from "@/lib/gamification";

function makeEntry(overrides: Partial<DiaryStatInput> & { place_id: string }): DiaryStatInput {
  return {
    city: "Milano",
    country: "Italy",
    score_overall: 4,
    score_meat: 4,
    score_bread: 4,
    score_sauces: 4,
    score_value: 4,
    score_location: 4,
    note: "Ottimo kebab.",
    ...overrides,
  };
}

describe("Local Personal Gamification Engine", () => {
  it("returns empty baseline for an empty diary (no Trust Score / no Hype Points)", () => {
    const snapshot = computePersonalGamification([]);

    expect(snapshot.xp.totalXp).toBe(0);
    expect(snapshot.level.current.level).toBe("PIVELLO DELLO SPIEDO");
    expect(snapshot.level.next?.level).toBe("ESPLORATORE DELLA PITA");
    expect(snapshot.level.xpToNextLevel).toBe(100);
    expect(snapshot.counters).toEqual({
      totalVisits: 0,
      uniqueShops: 0,
      citiesExplored: 0,
      countriesExplored: 0,
      averageOverallScore: null,
    });
    expect(snapshot.kebabIndex).toBe(0);
    expect(snapshot.badges.every((b) => !b.unlocked)).toBe(true);
    expect("trustScore" in snapshot).toBe(false);
    expect("hypePoints" in snapshot).toBe(false);
  });

  it("computes XP, unique geography counters, and badges purely from diary entries", () => {
    const entries: DiaryStatInput[] = [
      makeEntry({ place_id: "p1", city: "Milano", country: "Italy", score_overall: 5 }),
      makeEntry({ place_id: "p2", city: "milano", country: "italy", score_overall: 4 }), // same city/country case-insensitive
      makeEntry({ place_id: "p3", city: "Berlin", country: "Germany", score_overall: 4.5 }),
      makeEntry({ place_id: "p4", city: "Unknown", country: "France", score_overall: 3.5 }),
      makeEntry({ place_id: "p5", city: null, country: null, score_overall: 3 }),
    ];

    const snapshot = computePersonalGamification(entries);

    // 5 unique shops * 10 = 50
    // 2 valid unique cities (Milano::Italy, Berlin::Germany) * 15 = 30
    // 3 valid unique countries (Italy, Germany, France) * 25 = 75
    expect(snapshot.counters.totalVisits).toBe(5);
    expect(snapshot.counters.uniqueShops).toBe(5);
    expect(snapshot.counters.citiesExplored).toBe(2);
    expect(snapshot.counters.countriesExplored).toBe(3);
    expect(snapshot.counters.averageOverallScore).toBe(4);

    expect(snapshot.xp.xpFromVisits).toBe(5 * XP_PER_DIARY_ENTRY);
    expect(snapshot.xp.xpFromCities).toBe(2 * XP_PER_UNIQUE_CITY);
    expect(snapshot.xp.xpFromCountries).toBe(3 * XP_PER_UNIQUE_COUNTRY);
    expect(snapshot.xp.totalXp).toBe(155);

    expect(snapshot.level.current.level).toBe("ESPLORATORE DELLA PITA");

    const pioniere = snapshot.badges.find((b) => b.id === "pioniere");
    const globetrotter = snapshot.badges.find((b) => b.id === "globetrotter");
    const esploratore = snapshot.badges.find((b) => b.id === "esploratore");
    expect(pioniere?.unlocked).toBe(true);
    expect(globetrotter?.unlocked).toBe(true);
    expect(esploratore?.unlocked).toBe(false);
    expect(esploratore?.progressText).toBe("2/5");
  });

  it("resolves all 5 levels and exact threshold boundaries accurately", () => {
    expect(GAMIFICATION_LEVELS).toHaveLength(5);
    expect(resolveLevelForXp(0).current.level).toBe("PIVELLO DELLO SPIEDO");
    expect(resolveLevelForXp(99).current.level).toBe("PIVELLO DELLO SPIEDO");
    expect(resolveLevelForXp(100).current.level).toBe("ESPLORATORE DELLA PITA");
    expect(resolveLevelForXp(249).current.level).toBe("ESPLORATORE DELLA PITA");
    expect(resolveLevelForXp(250).current.level).toBe("CAVALIERE DELLA CIPOLLA");
    expect(resolveLevelForXp(499).current.level).toBe("CAVALIERE DELLA CIPOLLA");
    expect(resolveLevelForXp(500).current.level).toBe("GURU DELLA SALSA PICCANTE");
    expect(resolveLevelForXp(999).current.level).toBe("GURU DELLA SALSA PICCANTE");
    expect(resolveLevelForXp(1000).current.level).toBe("MAESTRO DELLO SPIEDO");
    expect(resolveLevelForXp(1000).next).toBeNull();
    expect(resolveLevelForXp(1500).progressPct).toBe(100);
  });

  it("calculates Kebab Index (0..100) from diary completeness without GPS checks", () => {
    expect(calculateKebabIndex([])).toBe(0);

    // Core scores only (no location, empty note) -> 50%
    expect(
      calculateKebabIndex([
        makeEntry({ place_id: "k1", score_location: null, note: "   " }),
      ])
    ).toBe(50);

    // Core + location, no note -> 75%
    expect(
      calculateKebabIndex([
        makeEntry({ place_id: "k2", score_location: 4, note: "" }),
      ])
    ).toBe(75);

    // Core + location + note -> 100%
    expect(
      calculateKebabIndex([
        makeEntry({ place_id: "k3", score_location: 5, note: "Top!" }),
      ])
    ).toBe(100);

    // Average of 50% and 100% -> 75%
    expect(
      calculateKebabIndex([
        makeEntry({ place_id: "k1", score_location: null, note: "" }),
        makeEntry({ place_id: "k3", score_location: 5, note: "Top!" }),
      ])
    ).toBe(75);
  });
});
