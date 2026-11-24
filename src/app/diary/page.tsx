import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import DiaryClient from "./DiaryClient";

export const metadata: Metadata = {
  description:
    "Registra i tuoi voti su carne, pane, salse, qualità/prezzo e location nel diario kebab personale di KebApps. Dati salvati solo sul tuo dispositivo con calcolo del Kebab Index.",
  alternates: {
    canonical: "/diary",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Valuta i migliori kebab e conserva le tue recensioni private in locale sul dispositivo.",
    url: "/diary",
  },
};

export default function DiaryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <DiaryClient />

      <section
        aria-label="Informazioni sul Diario Personale"
        className="bg-card p-5 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="size-4" />
          </div>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Il Diario KebApps valuta ogni kebab su 5 dimensioni (carne, pane, salse, qualità/prezzo e location), calcola il Kebab Index e resta privato nel browser tramite IndexedDB.
          </p>
        </div>
        <Link
          href="/map"
          className="text-xs font-black uppercase tracking-wider text-primary hover:underline shrink-0"
        >
          Trova locali su Mappa
        </Link>
      </section>
    </div>
  );
}
