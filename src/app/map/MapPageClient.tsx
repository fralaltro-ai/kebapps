"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapLoadingScreen } from "@/components/map/MapLoadingScreen";

const KebabMap = dynamic(() => import("@/components/KebabMap"), {
  ssr: false,
  loading: () => <MapLoadingScreen />,
});

export default function MapPageClient() {
  // Physically prevents the document from scrolling/bouncing on this route,
  // so a vertical drag on the map canvas can never move the page frame
  // (and with it the absolutely-positioned search bar / GPS button that
  // live inside [data-map-container]) instead of just panning the map.
  useEffect(() => {
    document.documentElement.classList.add("route-locked");
    return () => {
      document.documentElement.classList.remove("route-locked");
    };
  }, []);

  return (
    <Suspense fallback={<MapLoadingScreen />}>
      <KebabMap />
    </Suspense>
  );
}
