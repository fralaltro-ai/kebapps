import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";
import { Metadata } from "next";
import LegalContent from "@/components/ui/LegalContent";
import { ControllerIdentityNotice } from "@/components/legal/ControllerIdentityNotice";
import { COOKIE_POLICY as content } from "@/lib/docs-generated";

export const metadata: Metadata = {
  description: "Informativa su storage locale IndexedDB, cookie tecnici di terze parti e consensi preventivi su KebApps.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/cookie-policy",
  },
  openGraph: {
    title: "KebApps",
    description: "Informativa su storage locale, cookie tecnici di terze parti e consensi di KebApps.",
    url: "/cookie-policy",
  },
};

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6 animate-in fade-in duration-700">
      <Link href="/profile" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 gap-2 transition-colors flat-press">
        <ArrowLeft className="size-4" /> Torna al Profilo
      </Link>

      <div className="bg-card rounded-3xl shadow-flat border border-border p-6 sm:p-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20 shrink-0">
            <Cookie className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground font-quicksand leading-tight">Cookie Policy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Ultimo aggiornamento: 27 Novembre 2026</p>
          </div>
        </div>

        <ControllerIdentityNotice />
        <LegalContent content={content} />
      </div>
    </div>
  );
}
