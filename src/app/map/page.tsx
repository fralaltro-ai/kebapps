import type { Metadata } from "next";
import MapConsentGate from "@/components/MapConsentGate";
import MapPageClient from "./MapPageClient";

export const metadata: Metadata = {
  description:
    "Esplora la mappa interattiva di KebApps per trovare locali che vendono kebab e kebabbari nella tua zona, con consenso preventivo e salvataggio locale in Diario o Wishlist.",
  alternates: {
    canonical: "/map",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Trova kebabbari e locali che vendono kebab vicino a te sulla mappa interattiva local-first.",
    url: "/map",
  },
};

export default function MapPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] overflow-hidden relative">
      <h1 className="sr-only">Mappa Kebab e Locali che Vendono Kebab</h1>
      <MapConsentGate>
        <div className="flex-1 w-full relative h-full">
          <MapPageClient />
        </div>
      </MapConsentGate>
    </div>
  );
}
