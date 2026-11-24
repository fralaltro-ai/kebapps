import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import JsonLd from "@/components/seo/JsonLd";
import {
  buildSoftwareApplicationJsonLd,
  buildWebsiteJsonLd,
  getSiteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  description:
    "Trova locali che vendono kebab e kebabbari vicino a te sulla mappa interattiva, salva voti nel diario degustazione e organizza la tua wishlist kebab offline senza account.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Mappa kebab, diario personale a 5 dimensioni e wishlist offline 100% local-first sul tuo dispositivo.",
    url: "/",
  },
};

export default function HomePage() {
  const siteUrl = getSiteUrl();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <JsonLd data={buildWebsiteJsonLd(siteUrl)} />
      <JsonLd data={buildSoftwareApplicationJsonLd(siteUrl)} />

      <HomeClient />
    </div>
  );
}
