"use client";

import React from "react";
import { getGoogleMapsDeepLink } from "@/lib/geoUtils";
import { Car, Footprints, ExternalLink, X } from "lucide-react";
import { GoogleAttribution } from "@/components/ui/GoogleAttribution";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";

interface KebabShop {
  place_id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface RoutingPanelProps {
  destination: KebabShop;
  routingInfo: { distance: string; duration: string } | null;
  travelMode: "DRIVING" | "WALKING";
  onTravelModeChange: (mode: "DRIVING" | "WALKING") => void;
  onCancel: () => void;
}

export default function RoutingPanel({
  destination,
  routingInfo,
  travelMode,
  onTravelModeChange,
  onCancel,
}: RoutingPanelProps) {
  return (
    <div className="absolute bottom-[calc(var(--dock-h)+var(--dock-gap)+var(--safe-b)+0.75rem)] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-bottom-10 duration-500 ease-out">
      <div className="p-4 bg-card border-2 border-border rounded-[2rem] shadow-dropdown font-quicksand flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-primary ml-0.5 truncate">
                Stima (Linea d&apos;Aria)
              </span>
              <SectionInfoButton
                title="Stima del Percorso"
                subtitle="Calcolo Geodetico Offline"
                buttonSize="sm"
                ariaLabel="Info sul calcolo percorso"
                items={[
                  {
                    label: "Distanza Haversine",
                    description: "Calcolo geodetico istantaneo in linea d'aria a costo zero, senza chiamare API Directions esterne.",
                  },
                  {
                    label: "Tempi di Percorrenza",
                    description: "Stima a piedi a 5 km/h con fattore tortuosità 1.3x; stima in auto a 30 km/h con fattore tortuosità 1.4x.",
                  },
                ]}
              />
            </div>
            <div className="flex items-baseline gap-2 overflow-hidden">
              <span className="text-2xl font-black text-foreground tracking-tighter shrink-0">
                {routingInfo ? routingInfo.duration : "--"}
              </span>
              <span className="text-xs font-bold text-muted-foreground truncate">
                ({routingInfo ? routingInfo.distance : "--"})
              </span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-tight truncate">
              {destination.name ? `Verso ${destination.name}` : "Verso il locale selezionato"}
            </span>
          </div>

          <div className="flex p-1 bg-muted border border-border rounded-2xl shrink-0">
            <button
              onClick={() => onTravelModeChange('DRIVING')}
              className={`size-10 rounded-xl flex items-center justify-center transition-all flat-press ${travelMode === 'DRIVING' ? 'bg-primary text-primary-foreground shadow-flat border-0' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Modalità in auto"
            >
              <Car className="size-5" />
            </button>
            <button
              onClick={() => onTravelModeChange('WALKING')}
              className={`size-10 rounded-xl flex items-center justify-center transition-all flat-press ${travelMode === 'WALKING' ? 'bg-primary text-primary-foreground shadow-flat border-0' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Modalità a piedi"
            >
              <Footprints className="size-5" />
            </button>
          </div>
        </div>

        <div className="h-px bg-border w-full" />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="bg-card hover:bg-muted border border-border text-foreground py-2.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all shadow-sm flat-press flex items-center justify-center gap-2"
          >
            <X className="size-3.5" /> Esci
          </button>
          <a
            href={getGoogleMapsDeepLink(destination.latitude || 0, destination.longitude || 0)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all text-center shadow-flat border-0 flex items-center justify-center gap-2 flat-press"
          >
            <ExternalLink className="size-3.5" /> GOOGLE
          </a>
        </div>

        <GoogleAttribution />
      </div>
    </div>
  );
}