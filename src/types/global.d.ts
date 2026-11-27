import React from 'react';

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  size?: "normal" | "compact" | "flexible" | "invisible";
  theme?: "auto" | "light" | "dark";
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "error-callback"?: (errorCode?: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string | null) => void;
      remove: (widgetId: string | null) => void;
      execute: (container?: string | HTMLElement | null, options?: TurnstileRenderOptions) => void;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        ref?: React.RefObject<HTMLElement | null>;
        placeholder?: string;
        className?: string;
        country?: string;
      }, HTMLElement>;
    }
  }
}

export {};
