import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import WishlistClient from "./WishlistClient";

export const metadata: Metadata = {
  description:
    "Organizza la lista desideri dei locali che vendono kebab da provare con note personali, ordinamento per distanza GPS 100% offline e conversione immediata nel Diario.",
  alternates: {
    canonical: "/wishlist",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Lista desideri offline per kebabbari e locali da provare con calcolo distanza Haversine sul dispositivo.",
    url: "/wishlist",
  },
};

export default function WishlistPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <WishlistClient />

      <section
        aria-label="Informazioni sulla Wishlist offline"
        className="bg-card p-5 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Bookmark className="size-4" />
          </div>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            La Wishlist salva in locale i kebabbari che vuoi provare, calcola le distanze offline con la formula geodetica di Haversine e si converte con un tocco in una voce del Diario.
          </p>
        </div>
        <Link
          href="/diary"
          className="text-xs font-black uppercase tracking-wider text-primary hover:underline shrink-0"
        >
          Apri Diario
        </Link>
      </section>
    </div>
  );
}
