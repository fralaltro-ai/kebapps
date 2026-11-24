import type { Metadata } from "next";
import ProfilePreferencesClient from "@/components/profile/ProfilePreferencesClient";
import { ProfileSubpageHeader } from "@/components/profile/ProfileSubpageHeader";

export const metadata: Metadata = {
  description:
    "Scegli il tema Chiaro, Scuro o Sistema e gestisci i consensi preventivi per Google Maps e Geolocalizzazione GPS su KebApps.",
  alternates: {
    canonical: "/profile/preferences",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Preferenze aspetto e controllo granulare dei consensi Google Maps e GPS.",
    url: "/profile/preferences",
  },
};

export default function ProfilePreferencesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <ProfileSubpageHeader
        title="Tema & Consensi Dispositivo"
        subtitle="Personalizza l'aspetto dell'interfaccia e gestisci le autorizzazioni locali."
      />
      <ProfilePreferencesClient />
    </div>
  );
}
