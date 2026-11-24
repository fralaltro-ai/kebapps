"use client";

import { useEffect, useState } from "react";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

/**
 * Detects whether the mobile on-screen keyboard is open so fixed bottom chrome
 * (like the mobile navigation dock) can hide cleanly while typing.
 *
 * Intentionally avoids shifting fixed elements by `visualViewport` scroll/height
 * deltas: on mobile browsers (especially iOS Safari), scrolling back up expands
 * the browser chrome and temporarily desynchronizes `window.innerHeight` vs
 * `visualViewport`, which would otherwise bounce fixed elements into the middle
 * of the screen.
 */
export function useVisualViewportOffset() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const vv = window.visualViewport;
    let baselineHeight = Math.max(window.innerHeight, vv?.height ?? 0);
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const focusedEditable = isEditableElement(document.activeElement);
      const currentHeight = vv?.height ?? window.innerHeight;

      if (!focusedEditable) {
        baselineHeight = Math.max(baselineHeight, window.innerHeight, currentHeight);
        setKeyboardOpen(false);
        return;
      }

      if (!vv) {
        setKeyboardOpen(false);
        return;
      }

      setKeyboardOpen(baselineHeight - vv.height > 150);
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(update);
    };

    const handleOrientationChange = () => {
      baselineHeight = Math.max(window.innerHeight, vv?.height ?? 0);
      scheduleUpdate();
    };

    update();
    vv?.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", handleOrientationChange);
    document.addEventListener("focusin", scheduleUpdate);
    document.addEventListener("focusout", scheduleUpdate);

    return () => {
      vv?.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", handleOrientationChange);
      document.removeEventListener("focusin", scheduleUpdate);
      document.removeEventListener("focusout", scheduleUpdate);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return { offset: 0, keyboardOpen };
}
