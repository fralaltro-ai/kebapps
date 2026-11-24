"use client";

import React from "react";
import { useMapConsent } from "@/hooks/useMapConsent";
import { hasConfiguredGoogleMapsKey } from "@/lib/map-proxy-config";
import { MapPin, X, Shield, ChevronRight } from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { MapLoadingScreen } from "@/components/map/MapLoadingScreen";

interface MapConsentGateProps {
  children: React.ReactNode;
}

export default function MapConsentGate({ children }: MapConsentGateProps) {
  const { status, grantConsent, denyConsent } = useMapConsent();

  // In Modalità Zero-Cost (nessuna API Google live attiva) non viene caricato alcun
  // script di terze parti: evita di raccogliere/salvare un falso consenso Google Maps.
  if (!hasConfiguredGoogleMapsKey()) {
    return <>{children}</>;
  }

  // Verifica stato iniziale del consenso (evita flash del modal di consenso)
  if (status === "checking") {
    return <MapLoadingScreen />;
  }

  // Consenso già dato: renderizzare la mappa
  if (status === "granted") {
    return <>{children}</>;
  }

  // Consenso rifiutato: mostrare schermata informativa con possibilità di sblocco immediato
  if (status === "denied") {
    return (
      <div className="relative w-full h-full overflow-y-auto app-scroll overscroll-contain bg-background text-foreground font-quicksand p-3 pb-[calc(var(--dock-space)+0.5rem)] sm:p-4 flex flex-col">
        <div className="my-auto mx-auto bg-card rounded-3xl p-5 sm:p-7 max-w-md w-full border border-border shadow-dropdown text-center space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="size-14 sm:size-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
            <MapPin className="size-7 sm:size-8" />
          </div>
          
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground mb-2 uppercase tracking-tight">
              Mappa Google Non Attiva
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
              Hai scelto di disattivare Google Maps. Puoi continuare a esplorare l&apos;app in modalità solo testo oppure sbloccare la mappa interattiva in qualsiasi momento.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={grantConsent}
              className="w-full bg-primary text-primary-foreground font-black py-3.5 px-6 rounded-2xl shadow-flat flat-press flex items-center justify-center gap-2 tracking-wide uppercase text-sm"
            >
              <MapPin className="size-4" />
              Attiva Google Maps
              <ChevronRight className="size-4 ml-1" />
            </button>
            
            <div className="pt-1">
              <Link
                href="/"
                className="block w-full py-2.5 px-3 bg-muted/60 hover:bg-muted text-foreground text-xs font-black uppercase tracking-wider rounded-xl border border-border text-center transition-colors flat-press"
              >
                Torna alla Home
              </Link>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center font-medium pt-2 border-t border-border">
            Preferenze modificabili in qualsiasi momento nelle <Link href="/profile/preferences" className="text-primary font-bold hover:underline">Preferenze Profilo</Link>. Consulta <Link href="/privacy-policy" className="text-primary font-bold hover:underline">Privacy Policy</Link>, <Link href="/cookie-policy" className="text-primary font-bold hover:underline">Cookie Policy</Link> e <Link href="/terms" className="text-primary font-bold hover:underline">Termini di Servizio</Link>.
          </p>
        </div>
      </div>
    );
  }

  // Pending: mostrare placeholder con richiesta consenso
  return (
    <div className="relative w-full h-full overflow-hidden font-quicksand">
      {/* Placeholder Image */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center overflow-hidden">
        <NextImage
          src="/images/map-placeholder.webp"
          alt="Mappa placeholder"
          fill
          className="object-cover blur-[2px] opacity-40"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-background/30" />
      </div>

      {/* Consent Overlay */}
      <div
        role="region"
        aria-label="Consenso Google Maps"
        className="absolute inset-0 z-10 overflow-y-auto app-scroll overscroll-contain p-3 pb-[calc(var(--dock-space)+0.5rem)] sm:p-4 flex flex-col"
      >
        <div className="my-auto mx-auto bg-card/95 backdrop-blur-xl rounded-3xl shadow-dropdown p-5 sm:p-7 max-w-md w-full border border-border relative text-card-foreground">
          {/* Close/Deny Button */}
          <button
            onClick={denyConsent}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 size-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors flat-press"
            aria-label="Chiudi e continua senza mappa"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-3 mb-4 sm:mb-5 pr-8">
            <div className="size-11 sm:size-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
              <Shield className="size-5 sm:size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground uppercase tracking-tight">
                Attiva la Mappa
              </h2>
              <p className="text-xs text-muted-foreground font-bold">
                Per la tua privacy
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-foreground mb-3 leading-relaxed font-medium">
            La mappa interattiva utilizza <strong>Google Maps</strong> e la protezione anti-bot{" "}
            <strong>Cloudflare Turnstile</strong>, servizi di terze parti che trattano indirizzo IP,
            metadati tecnici ed eventuali cookie tecnici.
          </p>

          <p className="text-[11px] sm:text-xs text-muted-foreground mb-4 sm:mb-5 leading-relaxed">
            Nessuno di questi script viene caricato nelle altre pagine dell&apos;app. Cliccando{" "}
            <strong>&quot;Attiva Google Maps&quot;</strong> dichiari di avere almeno <strong>14 anni</strong>{" "}
            (o l&apos;autorizzazione dei genitori, Art. 2-quinquies D.Lgs. 196/2003) e acconsenti al caricamento dell&apos;SDK Google Maps
            (secondo le{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
              Norme sulla privacy di Google
            </a>{" "}
            e i{" "}
            <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
              Termini di Google Maps
            </a>
            ) e del widget di sicurezza anti-bot Cloudflare Turnstile. La tua scelta è salvata localmente per 180 giorni. Scegliendo &quot;Continua senza mappa&quot;
            nessuno script esterno verrà caricato. Puoi revocare il consenso in qualsiasi momento dalla mappa o dal tuo Profilo.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={grantConsent}
              className="w-full bg-primary text-primary-foreground font-black py-3.5 px-6 rounded-2xl shadow-flat flat-press flex items-center justify-center gap-2 tracking-wide uppercase text-sm"
            >
              <MapPin className="size-4" />
              Attiva Google Maps
              <ChevronRight className="size-4 ml-1" />
            </button>
            
            <button
              onClick={denyConsent}
              className="w-full text-muted-foreground hover:text-foreground text-xs font-bold py-2 transition-colors flat-press"
            >
              Continua senza mappa
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-3 sm:mt-4 font-medium">
            Consulta la{" "}
            <Link href="/privacy-policy" className="underline hover:text-foreground transition-colors font-bold">Privacy Policy</Link>, la{" "}
            <Link href="/cookie-policy" className="underline hover:text-foreground transition-colors font-bold">Cookie Policy</Link>{" "}
            e i{" "}
            <Link href="/terms" className="underline hover:text-foreground transition-colors font-bold">Termini di Servizio</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
