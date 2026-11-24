export const DEFAULT_SITE_URL = "https://kebapps.app";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  const normalized = raw.replace(/\/+$/, "");
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Fallback to default site URL if NEXT_PUBLIC_SITE_URL is malformed
  }
  return DEFAULT_SITE_URL;
}


export function buildWebsiteJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KebApps",
    url: siteUrl,
    inLanguage: "it-IT",
    description:
      "Mappa kebab e locali che vendono kebab, diario personale delle degustazioni e wishlist offline local-first.",
  };
}

export function buildSoftwareApplicationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "KebApps",
    url: siteUrl,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "All",
    inLanguage: "it-IT",
    isAccessibleForFree: true,
    description:
      "Web App Progressiva (PWA) 100% local-first per trovare locali che vendono kebab sulla mappa, salvare voti su carne, pane, salse e qualità/prezzo nel diario personale e gestire la wishlist offline.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    author: {
      "@type": "Person",
      name: "KebApps Maintainer",
      url: siteUrl,
    },
  };
}

