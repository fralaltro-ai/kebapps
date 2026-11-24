"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface MapAreaLoadingModalProps {
  title?: string;
  subtitle?: string;
}

export function MapAreaLoadingModal({
  title = "Caricamento locali...",
  subtitle = "Stiamo cercando i kebab in zona",
}: MapAreaLoadingModalProps) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200 font-quicksand pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-card border border-border rounded-3xl shadow-dropdown px-8 py-7 flex flex-col items-center gap-3 text-card-foreground animate-in zoom-in-95 duration-200">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-base font-black uppercase tracking-tight text-foreground text-center">
          {title}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default MapAreaLoadingModal;
