import type { Metadata } from "next";
import { ProfileInfoSection } from "@/components/profile/ProfileInfoSection";
import { ProfileSubpageHeader } from "@/components/profile/ProfileSubpageHeader";

export const metadata: Metadata = {
  description:
    "Contatti statici di supporto e accesso a Privacy Policy, Cookie & Storage Policy e Termini di Servizio di KebApps.",
  alternates: {
    canonical: "/profile/info",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Canali statici di assistenza e informative legali di KebApps.",
    url: "/profile/info",
  },
};

export default function ProfileInfoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <ProfileSubpageHeader
        title="Supporto, Info & Documenti"
        subtitle="Canali di contatto statici, trasparenza local-first e documentazione legale."
      />
      <ProfileInfoSection />
    </div>
  );
}
