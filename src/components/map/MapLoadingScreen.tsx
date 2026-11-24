import React from "react";
import { Utensils } from "lucide-react";

interface MapLoadingScreenProps {
  title?: string;
  subtitle?: string;
  stepLabel?: string;
  isInitialLoading?: boolean;
  isOverlay?: boolean;
}

export function MapLoadingScreen({
  title = "Ricerca locali in corso...",
  subtitle = "Preparazione mappa",
  stepLabel,
  isInitialLoading = true,
  isOverlay = false,
}: MapLoadingScreenProps) {
  const containerClasses = isOverlay
    ? `absolute inset-0 z-[100] flex flex-col items-center justify-center bg-background select-none font-quicksand transition-opacity duration-300 ${
        isInitialLoading
          ? "opacity-100 pointer-events-auto touch-none"
          : "opacity-0 pointer-events-none"
      }`
    : `flex flex-col items-center justify-center w-full h-full min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] bg-background text-foreground select-none font-quicksand ${
        isInitialLoading ? "pointer-events-auto touch-none" : "pointer-events-none"
      }`;

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-busy={isInitialLoading}
      aria-label={title}
    >
      <div className="size-20 mb-6 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-flat animate-pulse">
        <Utensils className="size-10 text-primary" />
      </div>
      <h2 className="text-xl font-black text-foreground uppercase tracking-tight text-center px-4">
        {title}
      </h2>
      <p className="mt-2 text-xs text-muted-foreground font-bold uppercase tracking-widest text-center px-4">
        {subtitle}
      </p>

      {stepLabel && (
        <div className="mt-4 px-3 py-1 rounded-xl bg-muted border border-border text-xs font-black uppercase tracking-wider text-muted-foreground">
          {stepLabel}
        </div>
      )}
    </div>
  );
}
