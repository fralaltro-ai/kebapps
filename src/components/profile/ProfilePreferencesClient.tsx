"use client";

import { useEffect, useState } from "react";
import { MapPin, Monitor, Moon, Navigation, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";
import { useToast } from "@/context/ToastContext";
import { useGpsConsent } from "@/hooks/useGpsConsent";
import { useMapConsent } from "@/hooks/useMapConsent";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export default function ProfilePreferencesClient() {
  const { theme, setTheme } = useTheme();
  const { success: toastSuccess, toast: toastInfo } = useToast();
  const {
    status: mapStatus,
    grantConsent: grantMapConsent,
    denyConsent: denyMapConsent,
  } = useMapConsent();
  const {
    status: gpsStatus,
    grantGpsConsent,
    denyGpsConsent,
  } = useGpsConsent();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleMapConsent = () => {
    triggerHaptic("light");
    if (mapStatus === "granted") {
      denyMapConsent();
      toastInfo("Consenso Google Maps revocato.", "warning");
    } else {
      grantMapConsent();
      toastSuccess("Google Maps attivato.");
    }
  };

  const handleToggleGpsConsent = () => {
    triggerHaptic("light");
    if (gpsStatus === "granted") {
      denyGpsConsent();
      toastInfo("Consenso GPS revocato.", "warning");
    } else {
      grantGpsConsent();
      toastSuccess("Geolocalizzazione GPS autorizzata.");
    }
  };

  return (
    <section className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
          Tema &amp; Consensi Dispositivo
        </h2>
        <SectionInfoButton
          title="Consensi Dispositivo & Trasparenza"
          subtitle="Controllo granulare su Google Maps e geolocalizzazione."
          buttonSize="sm"
          items={[
            {
              label: "Google Maps & Cloudflare Turnstile",
              description:
                "Blocca completamente gli script terzi di Google Maps e Cloudflare Turnstile finché il consenso non viene concesso esplicito. In caso di revoca, cache mappa effimera e sessione mappa vengono azzerate e nessuno script esterno viene caricato.",
            },
            {
              label: "Geolocalizzazione GPS & Bussola",
              description:
                "Usati sul tuo dispositivo (con coordinate in sessionStorage per la sola scheda aperta) per centrare la mappa, mostrare l'orientamento e calcolare le distanze offline (Haversine). Le coordinate puntuali non vengono salvate sui server di KebApps; quando centri la mappa live sulla tua zona, l'area viene richiesta all'SDK Google Maps e un riquadro circostante (quantizzato su griglia ~550 m) viene inviato a /api/shops.",
            },
          ]}
        />
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
          Aspetto Interfaccia
        </span>
        {mounted && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: "Chiaro", icon: Sun },
              { value: "dark", label: "Scuro", icon: Moon },
              { value: "system", label: "Sistema", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => {
                  triggerHaptic("light");
                  setTheme(value);
                }}
                className={cn(
                  "min-h-[44px] flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flat-press",
                  theme === value
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-muted/60 text-muted-foreground hover:border-primary/40"
                )}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin className="size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-foreground">
                Google Maps
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {mapStatus === "granted" ? "Consenso attivo" : "Disattivato"} · SDK cartografico Google LLC (IP e metadati tecnici previo consenso)
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="toggle-maps-consent-btn"
            onClick={handleToggleMapConsent}
            className={cn(
              "min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border flat-press shrink-0",
              mapStatus === "granted"
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-primary bg-primary text-primary-foreground"
            )}
          >
            {mapStatus === "granted" ? "Revoca" : "Attiva"}
          </button>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Navigation className="size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-foreground">
                Geolocalizzazione GPS
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {gpsStatus === "granted" ? "Autorizzato" : "Non autorizzato"} · Distanze offline sul dispositivo (in mappa live trasmette l&apos;area circostante quantizzata ~550 m)
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="toggle-gps-consent-btn"
            onClick={handleToggleGpsConsent}
            className={cn(
              "min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border flat-press shrink-0",
              gpsStatus === "granted"
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-primary bg-primary text-primary-foreground"
            )}
          >
            {gpsStatus === "granted" ? "Revoca" : "Attiva"}
          </button>
        </div>
      </div>
    </section>
  );
}
