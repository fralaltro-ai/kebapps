import type { Metadata } from "next";
import ProfileDataClient from "@/components/profile/ProfileDataClient";
import { ProfileSubpageHeader } from "@/components/profile/ProfileSubpageHeader";

export const metadata: Metadata = {
  description:
    "Visualizza lo spazio occupato in IndexedDB, esporta o importa i tuoi dati in Backup JSON o esegui il reset completo sul dispositivo.",
  alternates: {
    canonical: "/profile/data",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Esportazione, importazione e cancellazione integrale dei dati locali di KebApps.",
    url: "/profile/data",
  },
};

export default function ProfileDataPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <ProfileSubpageHeader
        title="Dati, Backup & Reset"
        subtitle="Controlla la memoria locale IndexedDB, esporta o importa Backup JSON."
      />
      <ProfileDataClient />
    </div>
  );
}
