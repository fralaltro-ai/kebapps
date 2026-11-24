// Mappatura livelli globali (overall rating) - 100% Positivi, zero emoji
export const EXPERIENCE_LEVELS = [
  { value: 5, icon: "Sparkles", color: "text-amber-800 dark:text-amber-300", bg: "bg-amber-500/10 dark:bg-amber-500/15", border: "border-amber-300/80 dark:border-amber-500/30", label: "Lo sognerei anche di notte", short: "Da Sogno" },
  { value: 4, icon: "ShieldCheck", color: "text-orange-800 dark:text-orange-300", bg: "bg-orange-500/10 dark:bg-orange-500/15", border: "border-orange-300/80 dark:border-orange-500/30", label: "Una garanzia, ci tornerei ogni settimana", short: "Garanzia" },
  { value: 3, icon: "ThumbsUp", color: "text-emerald-800 dark:text-emerald-300", bg: "bg-emerald-500/10 dark:bg-emerald-500/15", border: "border-emerald-300/80 dark:border-emerald-500/30", label: "Un ottimo alleato per un pranzo veloce", short: "Buon Alleato" },
  { value: 2, icon: "Zap", color: "text-blue-800 dark:text-blue-300", bg: "bg-blue-500/10 dark:bg-blue-500/15", border: "border-blue-300/80 dark:border-blue-500/30", label: "Scelta pratica e senza fronzoli", short: "Spuntino Smart" },
  { value: 1, icon: "Compass", color: "text-purple-800 dark:text-purple-300", bg: "bg-purple-500/10 dark:bg-purple-500/15", border: "border-purple-300/80 dark:border-purple-500/30", label: "Locale da esplorare e approfondire", short: "In Esplorazione" },
] as const;

// Mappatura per singoli componenti (Carne, Pane, Salse, Rapporto Q/P)
export const COMPONENT_DESCRIPTORS = {
  meat: [
    { value: 5, label: "Succulenta, perfettamente speziata" },
    { value: 4, label: "Saporita e ben cotta" },
    { value: 3, label: "Nella media, fa il suo dovere" },
    { value: 2, label: "Un po' secca o insapore" },
    { value: 1, label: "Non mi ha convinto" },
  ],
  bread: [
    { value: 5, label: "Fragrante e croccante al punto giusto" },
    { value: 4, label: "Buon pane, fresco" },
    { value: 3, label: "Pane standard, niente di speciale" },
    { value: 2, label: "Un po' mollo o stantio" },
    { value: 1, label: "Non all'altezza" },
  ],
  sauces: [
    { value: 5, label: "Mix perfetto, cremose e bilanciate" },
    { value: 4, label: "Buone salse, giusta varietà" },
    { value: 3, label: "Salse base, nulla di memorabile" },
    { value: 2, label: "Poca scelta o troppo dominanti" },
    { value: 1, label: "Meglio senza" },
  ],
  value: [
    { value: 5, label: "Un affare incredibile per quello che offre" },
    { value: 4, label: "Prezzo giusto per la qualità" },
    { value: 3, label: "Nella norma" },
    { value: 2, label: "Un po' caro per quello che offre" },
    { value: 1, label: "Non vale il prezzo" },
  ],
  location: [
    { value: 5, label: "Un posto da cartolina, ci torni solo per l'atmosfera" },
    { value: 4, label: "Ambiente curato e accogliente" },
    { value: 3, label: "Nella norma, niente di speciale" },
    { value: 2, label: "Un po' trascurato o scomodo" },
    { value: 1, label: "Non pervenuto" },
  ],
} as const;

export const CATEGORY_META = {
  meat:     { icon: 'Flame',        label: 'Carne',          short: 'Carne' },
  bread:    { icon: 'Layers',       label: 'Pane/Piadina',   short: 'Pane' },
  sauces:   { icon: 'Droplets',     label: 'Salse',          short: 'Salse' },
  value:    { icon: 'BadgePercent', label: 'Prezzo/Qualità', short: 'Q/P' },
  location: { icon: 'MapPin',       label: 'Location',       short: 'Location' },
} as const;

export function getLevelByValue(value: number): typeof EXPERIENCE_LEVELS[number] {
  const rounded = Math.round(value);
  return EXPERIENCE_LEVELS.find((l) => l.value === rounded) || EXPERIENCE_LEVELS[2]; // Default: 3
}

export function getShortLabel(value: number): string {
  return getLevelByValue(value).short;
}

export function getComponentDescriptor(component: keyof typeof COMPONENT_DESCRIPTORS, value: number): string {
  const rounded = Math.round(value);
  const comp = COMPONENT_DESCRIPTORS[component];
  const level = comp.find((l) => l.value === rounded) || comp.find((l) => l.value === 3);
  return level ? level.label : "";
}

export function ratingToExperienceLevel(averageRating: number): typeof EXPERIENCE_LEVELS[number] {
  // Round to nearest integer to find the bucket
  const rounded = Math.round(averageRating);
  return EXPERIENCE_LEVELS.find((l) => l.value === rounded) || EXPERIENCE_LEVELS[2];
}

export function calculateReviewAverage(review: { score_meat: number; score_sauces: number; score_bread: number; score_value: number; score_location?: number | null }): number {
  const base = review.score_meat + review.score_sauces + review.score_bread + review.score_value;
  const locationScore = review.score_location ?? (base / 4);
  return (base + locationScore) / 5;
}
