import type { DiaryEntry } from "./local-storage/schema";

export const XP_PER_DIARY_ENTRY = 10;
export const XP_PER_UNIQUE_CITY = 15;
export const XP_PER_UNIQUE_COUNTRY = 25;

export interface GamificationLevelDefinition {
  level: string;
  title: string;
  description: string;
  minXp: number;
  maxXp: number | null;
}

export const GAMIFICATION_LEVELS: readonly GamificationLevelDefinition[] = [
  {
    level: "PIVELLO DELLO SPIEDO",
    title: "Le Prime Armi",
    description:
      "Hai appena iniziato il tuo diario personale. Annota i primi locali per far salire la tua esperienza!",
    minXp: 0,
    maxXp: 99,
  },
  {
    level: "ESPLORATORE DELLA PITA",
    title: "Palato in Evoluzione",
    description:
      "Inizi a distinguere le spezie fresche dalle polveri stantie tra una tappa e l'altra.",
    minXp: 100,
    maxXp: 249,
  },
  {
    level: "CAVALIERE DELLA CIPOLLA",
    title: "La Nobiltà dello Spiedo",
    description:
      "Nessun pianto davanti alla cipolla cruda: il tuo diario racconta ormai veri classici.",
    minXp: 250,
    maxXp: 499,
  },
  {
    level: "GURU DELLA SALSA PICCANTE",
    title: "Palato d'Acciaio",
    description:
      "Le tue papille non temono nulla e la tua mappa personale copre sempre più città.",
    minXp: 500,
    maxXp: 999,
  },
  {
    level: "MAESTRO DELLO SPIEDO",
    title: "La Leggenda Suprema",
    description:
      "Sei l'autorità assoluta del tuo archivio personale del Kebab.",
    minXp: 1000,
    maxXp: null,
  },
] as const;

export interface PersonalBadgeProgress {
  id: "pioniere" | "esploratore" | "gourmet" | "globetrotter";
  name: string;
  unlocked: boolean;
  description: string;
  progressText: string;
  current: number;
  target: number;
}

export interface PersonalGamificationSnapshot {
  xp: {
    totalXp: number;
    xpFromVisits: number;
    xpFromCities: number;
    xpFromCountries: number;
  };
  level: {
    current: GamificationLevelDefinition;
    next: GamificationLevelDefinition | null;
    levelIndex: number;
    xpIntoLevel: number;
    xpToNextLevel: number;
    progressPct: number;
  };
  counters: {
    totalVisits: number;
    uniqueShops: number;
    citiesExplored: number;
    countriesExplored: number;
    averageOverallScore: number | null;
  };
  kebabIndex: number;
  badges: PersonalBadgeProgress[];
}

export type DiaryStatInput = Pick<
  DiaryEntry,
  | "place_id"
  | "city"
  | "country"
  | "score_overall"
  | "score_meat"
  | "score_bread"
  | "score_sauces"
  | "score_value"
  | "score_location"
  | "note"
>;

function normalizeGeoPlace(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "unknown") return null;
  return trimmed.toLowerCase();
}

function isValidScore(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Calculates personal Kebab Index (0..100) from Diary completeness alone:
 * - 50 pts: all 4 core dimensions rated (meat, bread, sauces, value)
 * - +25 pts: location rated
 * - +25 pts: personal note filled
 */
export function calculateKebabIndex(entries: readonly DiaryStatInput[]): number {
  if (entries.length === 0) return 0;

  let totalScore = 0;
  for (const entry of entries) {
    let entryPct = 0;
    const hasCore =
      isValidScore(entry.score_meat) &&
      isValidScore(entry.score_bread) &&
      isValidScore(entry.score_sauces) &&
      isValidScore(entry.score_value);

    if (hasCore) entryPct += 50;
    if (isValidScore(entry.score_location)) entryPct += 25;
    if (typeof entry.note === "string" && entry.note.trim().length > 0) entryPct += 25;

    totalScore += entryPct;
  }

  return Math.round(totalScore / entries.length);
}

export function resolveLevelForXp(totalXp: number): {
  current: GamificationLevelDefinition;
  next: GamificationLevelDefinition | null;
  levelIndex: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let levelIndex = 0;

  for (let i = 0; i < GAMIFICATION_LEVELS.length; i++) {
    const def = GAMIFICATION_LEVELS[i];
    if (safeXp >= def.minXp && (def.maxXp === null || safeXp <= def.maxXp)) {
      levelIndex = i;
      break;
    }
  }

  const current = GAMIFICATION_LEVELS[levelIndex];
  const next =
    levelIndex < GAMIFICATION_LEVELS.length - 1
      ? GAMIFICATION_LEVELS[levelIndex + 1]
      : null;

  const xpIntoLevel = safeXp - current.minXp;
  if (!next) {
    return {
      current,
      next: null,
      levelIndex,
      xpIntoLevel,
      xpToNextLevel: 0,
      progressPct: 100,
    };
  }

  const span = next.minXp - current.minXp;
  const xpToNextLevel = Math.max(0, next.minXp - safeXp);
  const progressPct = Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100)));

  return {
    current,
    next,
    levelIndex,
    xpIntoLevel,
    xpToNextLevel,
    progressPct,
  };
}

export function computePersonalGamification(
  entries: readonly DiaryStatInput[]
): PersonalGamificationSnapshot {
  const uniqueShopIds = new Set<string>();
  const uniqueCities = new Set<string>();
  const uniqueCountries = new Set<string>();

  let scoreSum = 0;
  for (const entry of entries) {
    uniqueShopIds.add(entry.place_id);
    const cityKey = normalizeGeoPlace(entry.city);
    const countryKey = normalizeGeoPlace(entry.country);

    if (cityKey) {
      uniqueCities.add(countryKey ? `${cityKey}::${countryKey}` : cityKey);
    }
    if (countryKey) {
      uniqueCountries.add(countryKey);
    }
    scoreSum += entry.score_overall;
  }

  const totalVisits = entries.length;
  const uniqueShops = uniqueShopIds.size;
  const citiesExplored = uniqueCities.size;
  const countriesExplored = uniqueCountries.size;
  const averageOverallScore =
    totalVisits > 0 ? Number((scoreSum / totalVisits).toFixed(2)) : null;

  const xpFromVisits = uniqueShops * XP_PER_DIARY_ENTRY;
  const xpFromCities = citiesExplored * XP_PER_UNIQUE_CITY;
  const xpFromCountries = countriesExplored * XP_PER_UNIQUE_COUNTRY;
  const totalXp = xpFromVisits + xpFromCities + xpFromCountries;

  const level = resolveLevelForXp(totalXp);
  const kebabIndex = calculateKebabIndex(entries);

  const badges: PersonalBadgeProgress[] = [
    {
      id: "pioniere",
      name: "Pioniere",
      unlocked: uniqueShops >= 1,
      description: "Inserisci il tuo primo locale nel diario personale.",
      current: Math.min(uniqueShops, 1),
      target: 1,
      progressText: `${Math.min(uniqueShops, 1)}/1`,
    },
    {
      id: "esploratore",
      name: "Esploratore",
      unlocked: citiesExplored >= 5,
      description: "Annota locali in almeno 5 città diverse.",
      current: Math.min(citiesExplored, 5),
      target: 5,
      progressText: `${citiesExplored}/5`,
    },
    {
      id: "gourmet",
      name: "Gourmet",
      unlocked: citiesExplored >= 15,
      description: "Annota locali in almeno 15 città diverse.",
      current: Math.min(citiesExplored, 15),
      target: 15,
      progressText: `${citiesExplored}/15`,
    },
    {
      id: "globetrotter",
      name: "Globetrotter",
      unlocked: countriesExplored >= 3,
      description: "Annota locali in almeno 3 nazioni diverse.",
      current: Math.min(countriesExplored, 3),
      target: 3,
      progressText: `${countriesExplored}/3`,
    },
  ];

  return {
    xp: {
      totalXp,
      xpFromVisits,
      xpFromCities,
      xpFromCountries,
    },
    level,
    counters: {
      totalVisits,
      uniqueShops,
      citiesExplored,
      countriesExplored,
      averageOverallScore,
    },
    kebabIndex,
    badges,
  };
}
