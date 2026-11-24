"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Star, Bookmark } from "lucide-react";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/pwa-utils";

const ONBOARDING_DELAY_MS = 1200;

const STEPS = [
  {
    icon: MapPin,
    title: "Scopri sulla Mappa",
    description:
      "Trova locali kebab sulla mappa con ricerca On-Submit dietro tuo consenso, oppure aggiungi le tappe manualmente.",
  },
  {
    icon: Star,
    title: "Valuta a 5 Dimensioni",
    description:
      "Assegna voti su Carne, Pane, Salse, Qualità/Prezzo e Location opzionale: ogni scheda aggiorna XP e Kebab Index.",
  },
  {
    icon: Bookmark,
    title: "Diario & Wishlist Locali",
    description:
      "Tutti i dati restano salvati solo sul tuo dispositivo (IndexedDB), con supporto offline e Backup JSON senza account.",
  },
];

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (hasSeenOnboarding()) return;

    const timer = setTimeout(() => {
      setShow(true);
    }, ONBOARDING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") completeOnboarding();
    };
    window.addEventListener("keydown", handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [show]);

  const completeOnboarding = () => {
    markOnboardingSeen();
    setShow(false);
  };

  // Prevent showing the onboarding on dedicated legal info routes
  const LEGAL_ROUTES = ["/privacy-policy", "/cookie-policy", "/terms"];
  const isPublicRoute = pathname ? LEGAL_ROUTES.includes(pathname) : false;

  if (!show || !mounted || isPublicRoute) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-500 font-quicksand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-md max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border-2 border-border shadow-dropdown relative animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-500"
      >
        {/* Header Graphic */}
        <div className="bg-primary pt-6 pb-5 sm:pt-7 sm:pb-6 px-5 sm:px-6 text-center relative flex flex-col items-center shrink-0 rounded-t-3xl">
          <div className="relative z-10 size-16 mb-3 rounded-2xl bg-white/95 p-1.5 border border-border/50 shadow-flat flex items-center justify-center">
            <Image
              src="/logo.svg"
              alt="KebApps"
              width={56}
              height={56}
              className="w-full h-full object-contain"
            />
          </div>
          <h2
            id="onboarding-title"
            className="relative z-10 text-primary-foreground font-black text-xl sm:text-2xl uppercase tracking-tighter"
          >
            Benvenuto in <span className="opacity-90">KebApps</span>
          </h2>
        </div>

        {/* Content */}
        <div
          className="app-scroll p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto"
          style={{ paddingBottom: "calc(1.25rem + var(--safe-b, 0px))" }}
        >
          <p className="text-center text-xs sm:text-sm font-semibold text-muted-foreground px-1 leading-relaxed">
            Scopri i kebabbari sulla mappa e salva voti e locali da provare sul tuo dispositivo, senza account.
          </p>

          <div className="space-y-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="flex items-start gap-3 sm:gap-4 bg-muted/50 p-3.5 sm:p-4 rounded-2xl border border-border"
                >
                  <div className="bg-primary p-2 text-primary-foreground rounded-xl border border-primary/40 shrink-0 mt-0.5">
                    <Icon className="size-4 sm:size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h4 className="font-black text-xs uppercase tracking-wider text-foreground">
                      {step.title}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={completeOnboarding}
            className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm uppercase tracking-widest py-3.5 sm:py-4 rounded-xl shadow-flat flat-press"
          >
            Inizia ora
          </button>

          <p className="text-[11px] text-muted-foreground text-center font-medium leading-relaxed">
            Continuando dichiari di avere almeno 14 anni (o l&apos;autorizzazione genitoriale per eventuali consensi) e puoi consultare{" "}
            <Link href="/privacy-policy" onClick={completeOnboarding} className="text-primary font-bold hover:underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link href="/cookie-policy" onClick={completeOnboarding} className="text-primary font-bold hover:underline">
              Cookie Policy
            </Link>{" "}
            e{" "}
            <Link href="/terms" onClick={completeOnboarding} className="text-primary font-bold hover:underline">
              Termini di Servizio
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
