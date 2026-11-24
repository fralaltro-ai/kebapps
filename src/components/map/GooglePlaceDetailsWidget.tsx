"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

interface GooglePlaceDetailsWidgetProps {
  placeId: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Renders Google Maps Platform's official Places UI Kit compact details element
 * (`<gmp-place-details-compact>`). Under Google Maps Platform EEA Terms,
 * Places UI Kit components are explicitly exempt from the "No Use With any Map"
 * restriction while keeping place content strictly inside Google's managed UI.
 */
export default function GooglePlaceDetailsWidget({
  placeId,
}: GooglePlaceDetailsWidgetProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let active = true;
    const host = hostRef.current;
    if (!host) return;

    const mapsApi =
      typeof window !== "undefined"
        ? (window.google?.maps as
            | (typeof google.maps & {
                importLibrary?: (lib: string) => Promise<unknown>;
              })
            | undefined)
        : undefined;

    if (!mapsApi || typeof mapsApi.importLibrary !== "function") {
      setStatus("fallback");
      return;
    }

    setStatus("loading");
    host.innerHTML = "";

    void mapsApi
      .importLibrary("places")
      .then(() => {
        if (!active || !hostRef.current) return;
        const container = hostRef.current;
        container.innerHTML = "";

        const card = document.createElement("gmp-place-details-compact");
        card.setAttribute("orientation", "horizontal");
        card.setAttribute("truncation-preferred", "");
        card.style.display = "block";
        card.style.width = "100%";
        card.style.borderRadius = "1rem";
        card.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";

        const req = document.createElement("gmp-place-details-place-request") as HTMLElement & {
          place?: string;
        };
        req.place = placeId;
        req.setAttribute("place", placeId);

        const placeName = document.createElement("gmp-place-name");
        const placeAddress = document.createElement("gmp-place-address");
        const placeAttribution = document.createElement("gmp-place-attribution");

        card.appendChild(req);
        card.appendChild(placeName);
        card.appendChild(placeAddress);
        card.appendChild(placeAttribution);
        container.appendChild(card);

        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("fallback");
      });

    return () => {
      active = false;
      host.innerHTML = "";
    };
  }, [placeId, resolvedTheme]);

  if (status === "fallback") {
    return (
      <div className="rounded-2xl bg-muted/50 border border-border px-3 py-2.5 text-xs text-muted-foreground font-medium">
        Locale verificato su Google Maps (apri il collegamento qui sotto per i dettagli ufficiali o assegna un nome personale nel tuo Diario).
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {status === "loading" && (
        <div className="h-14 rounded-2xl bg-muted/50 border border-border animate-pulse" />
      )}
      <div ref={hostRef} className="w-full min-w-0 overflow-hidden rounded-2xl" />
    </div>
  );
}
