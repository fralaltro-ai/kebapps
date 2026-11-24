import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  description:
    "Personalizza nickname, avatar SVG, monitora progressione XP e badge, e accedi alle impostazioni di tema, consensi, Backup JSON e informative legali di KebApps.",
  alternates: {
    canonical: "/profile",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Identità locale, livelli XP, badge e hub impostazioni di KebApps.",
    url: "/profile",
  },
};

export default function ProfilePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      <ProfileClient />
    </div>
  );
}
