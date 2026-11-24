"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { getGoogleMapsDeepLink } from "@/lib/geoUtils";
import { GoogleAttribution } from "../ui/GoogleAttribution";

interface UnverifiedShopCardProps {
  unverifiedPlace: {
    placeId: string;
    latLng: google.maps.LatLngLiteral;
  };
  onClose: () => void;
}

export default function UnverifiedShopCard({
  unverifiedPlace,
  onClose,
}: UnverifiedShopCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-background/55 backdrop-blur-[2px] animate-in fade-in duration-150 font-quicksand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unverified-shop-card-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] drop-shadow-md cursor-auto pointer-events-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 w-full bg-card border border-border shadow-dropdown rounded-3xl font-quicksand relative text-card-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain app-scroll">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 size-7 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full flex items-center justify-center transition-colors flat-press z-30"
            aria-label="Chiudi scheda"
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-col gap-2">
            <h3 id="unverified-shop-card-title" className="font-extrabold text-primary text-sm uppercase tracking-wider pr-8">
              Punto Mappa Selezionato
            </h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed pr-2">
              Questo punto non appartiene ai locali kebab rilevati in zona. Puoi aprirlo direttamente su Google Maps.
            </p>
            <a
              href={getGoogleMapsDeepLink(unverifiedPlace.latLng.lat, unverifiedPlace.latLng.lng)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-full py-2 px-3 rounded-2xl bg-muted/60 hover:bg-muted border border-border text-[11px] uppercase tracking-wider font-black text-primary flex items-center justify-center gap-1.5 transition-colors flat-press"
            >
              Apri in Google Maps <ExternalLink className="size-3.5 shrink-0" />
            </a>
            <GoogleAttribution className="mt-1 text-center" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
