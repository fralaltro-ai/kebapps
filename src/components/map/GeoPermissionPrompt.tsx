"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Shield, ChevronRight } from "lucide-react";

interface GeoPermissionPromptProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function GeoPermissionPrompt({ onAccept, onDecline }: GeoPermissionPromptProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDecline();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDecline]);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-permission-title"
      className="fixed inset-0 z-[115] overflow-y-auto app-scroll overscroll-contain bg-background/80 backdrop-blur-sm p-3 sm:p-4 pt-[calc(0.75rem+var(--safe-t))] pb-[calc(0.75rem+var(--safe-b))] flex flex-col pointer-events-auto font-quicksand animate-in fade-in duration-300"
    >
      <div className="my-auto mx-auto bg-card rounded-3xl shadow-dropdown border border-border max-w-sm w-full p-5 sm:p-7 text-center relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 text-card-foreground">
        <div className="relative z-10">
          <div className="size-14 sm:size-16 bg-primary/10 rounded-2xl sm:rounded-3xl flex items-center justify-center text-primary mx-auto mb-3 sm:mb-5 border border-primary/20">
            <MapPin className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <h2
            id="geo-permission-title"
            className="text-xl sm:text-2xl font-black text-foreground mb-2.5 sm:mb-3 font-quicksand leading-tight uppercase"
          >
            Attiva la Posizione
          </h2>
          
          <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
            KebApps utilizza posizione e orientamento <span className="text-primary font-bold uppercase tracking-tight">esclusivamente</span> per:
          </p>

          <ul className="text-left space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
            <li className="flex gap-3 items-start">
              <div className="size-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                <div className="size-2 bg-primary rounded-full" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Centrare la mappa, mostrare la direzione (bussola) e trovare i kebab shop nelle tue vicinanze.</p>
            </li>
            <li className="flex gap-3 items-start">
              <div className="size-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                <div className="size-2 bg-primary rounded-full" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Calcolare distanze e tempi di percorrenza offline sul tuo dispositivo.</p>
            </li>
          </ul>

          <div className="bg-blue-500/10 dark:bg-blue-950/30 p-3 sm:p-3.5 rounded-2xl mb-5 sm:mb-6 border border-blue-500/20 flex items-center gap-3">
            <Shield className="size-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300 font-bold text-left leading-tight">
              Le coordinate GPS restano nella sola scheda aperta (cancellate alla chiusura o revoca) e non vengono salvate su database KebApps. Quando centri la mappa live sulla tua posizione, i dati cartografici dell&apos;area vengono richiesti a Google Maps e il riquadro visibile (arrotondato a una griglia di ~550 m) è inviato a /api/shops. Consenso riservato a utenti di almeno 14 anni (o con consenso genitoriale).
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onAccept}
              className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl transition-all shadow-flat flat-press flex items-center justify-center gap-2 group"
            >
              ACCETTA E CONTINUA
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="text-xs font-bold text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              No, grazie
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
