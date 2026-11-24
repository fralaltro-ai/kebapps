"use client";

import React, { useEffect, useRef, memo, useState } from "react";
import { useGoogleMap } from "@react-google-maps/api";
import { createPortal } from "react-dom";

interface AdvancedMarkerProps {
  position: google.maps.LatLngLiteral;
  children?: React.ReactNode;
  onClick?: () => void;
  zIndex?: number;
  anchor?: "bottom" | "center";
  clickable?: boolean;
}

/**
 * Custom Advanced Marker component because @react-google-maps/api 
 * doesn't fully support AdvancedMarkerElement as a standalone component yet.
 */
const KebabAdvancedMarker = ({
  position,
  children,
  onClick,
  zIndex,
  anchor = "bottom",
  clickable = true,
}: AdvancedMarkerProps) => {
  const map = useGoogleMap();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const lastAppliedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const onClickRef = useRef(onClick);
  const latestPositionRef = useRef(position);
  latestPositionRef.current = position;
  const latestZIndexRef = useRef(zIndex);
  latestZIndexRef.current = zIndex;

  // Sync the latest onClick handler without triggering re-creation of the marker
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let marker: google.maps.marker.AdvancedMarkerElement | null = null;

    const handleGmpClick = () => {
      if (onClickRef.current) onClickRef.current();
    };

    const mountMarker = (
      AdvancedMarker: typeof google.maps.marker.AdvancedMarkerElement
    ) => {
      if (cancelled || markerRef.current) return;
      const pos = latestPositionRef.current;
      if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
        return;
      }

      const div = document.createElement("div");
      if (anchor === "center") {
        div.style.width = "0px";
        div.style.height = "0px";
        div.style.overflow = "visible";
      } else {
        div.style.width = "48px";
        div.style.height = "48px";
      }
      div.style.display = "block";
      div.style.position = "relative";
      div.style.cursor = clickable ? "pointer" : "default";
      div.style.userSelect = "none";
      setContainer(div);

      try {
        marker = new AdvancedMarker({
          map,
          position: { lat: pos.lat, lng: pos.lng },
          content: div,
          zIndex: latestZIndexRef.current || 0,
          gmpClickable: clickable,
        });

        markerRef.current = marker;
        lastAppliedPosRef.current = { lat: pos.lat, lng: pos.lng };

        if (clickable) {
          marker.addEventListener("gmp-click", handleGmpClick);
        }
      } catch (e) {
        console.error("Failed to create AdvancedMarkerElement", e);
        markerRef.current = null;
        lastAppliedPosRef.current = null;
        setContainer(null);
      }
    };

    const syncAdvancedMarker =
      typeof window !== "undefined"
        ? window.google?.maps?.marker?.AdvancedMarkerElement
        : undefined;

    if (syncAdvancedMarker) {
      mountMarker(syncAdvancedMarker);
    } else {
      const mapsApi =
        typeof window !== "undefined"
          ? (window.google?.maps as
              | (typeof google.maps & {
                  importLibrary?: (lib: string) => Promise<unknown>;
                })
              | undefined)
          : undefined;

      if (mapsApi && typeof mapsApi.importLibrary === "function") {
        void mapsApi
          .importLibrary("marker")
          .then((lib) => {
            if (cancelled) return;
            const markerLib = lib as
              | { AdvancedMarkerElement?: typeof google.maps.marker.AdvancedMarkerElement }
              | undefined;
            const Ctor =
              markerLib?.AdvancedMarkerElement ||
              window.google?.maps?.marker?.AdvancedMarkerElement;
            if (Ctor) {
              mountMarker(Ctor);
            }
          })
          .catch((e) => {
            console.warn("Failed to import Google Maps marker library:", e);
          });
      } else {
        let attempts = 0;
        pollTimer = setInterval(() => {
          attempts++;
          const Ctor =
            typeof window !== "undefined"
              ? window.google?.maps?.marker?.AdvancedMarkerElement
              : undefined;
          if (Ctor) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            mountMarker(Ctor);
          } else if (attempts >= 10) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            console.warn("AdvancedMarkerElement not available yet");
          }
        }, 200);
      }
    }

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (marker) {
        try {
          if (clickable) {
            marker.removeEventListener("gmp-click", handleGmpClick);
          }
          marker.map = null;
        } catch (e) {
          console.error("Failed to clean up AdvancedMarkerElement", e);
        }
      }
      markerRef.current = null;
      lastAppliedPosRef.current = null;
    };
  }, [map, anchor, clickable]); // Recreate if map, anchor or clickable mode changes

  // Update position if it changes
  useEffect(() => {
    if (!markerRef.current || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
      return;
    }
    if (
      lastAppliedPosRef.current?.lat === position.lat &&
      lastAppliedPosRef.current?.lng === position.lng
    ) {
      return;
    }
    try {
      markerRef.current.position = { lat: position.lat, lng: position.lng };
      lastAppliedPosRef.current = { lat: position.lat, lng: position.lng };
    } catch (e) {
      console.error("Failed to update AdvancedMarkerElement position", e);
      markerRef.current = null;
      lastAppliedPosRef.current = null;
    }
  }, [position.lat, position.lng]);

  // Update zIndex if it changes
  useEffect(() => {
    if (markerRef.current && zIndex !== undefined) {
      try {
        markerRef.current.zIndex = zIndex;
      } catch (e) {
        console.error("Failed to update AdvancedMarkerElement zIndex", e);
      }
    }
  }, [zIndex]);

  return container && children ? createPortal(children, container) : null;
};

const MemoizedKebabAdvancedMarker = memo(KebabAdvancedMarker);
MemoizedKebabAdvancedMarker.displayName = "KebabAdvancedMarker";

export default MemoizedKebabAdvancedMarker;
