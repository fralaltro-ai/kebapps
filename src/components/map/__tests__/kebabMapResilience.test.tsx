import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { resetLocalDbAdapterForTests } from "@/lib/local-storage/db";

let mockSearchParamsValue: URLSearchParams | undefined | null = undefined;
let mockLoaderState: { isLoaded: boolean; loadError?: Error } = { isLoaded: false };
let mockGoogleMapShouldThrow = false;
const mockGoogleMapInstance = {};
const capturedLoaderOptions: Array<{ libraries?: string[]; googleMapsApiKey?: string }> = [];

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParamsValue,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@react-google-maps/api", () => ({
  useJsApiLoader: (opts: { libraries?: string[]; googleMapsApiKey?: string }) => {
    capturedLoaderOptions.push(opts);
    return mockLoaderState;
  },
  GoogleMap: ({ children }: { children?: React.ReactNode }) => {
    if (mockGoogleMapShouldThrow) {
      throw new TypeError("Cannot read properties of undefined (reading 'get')");
    }
    return <div data-testid="mock-google-map">{children}</div>;
  },
  useGoogleMap: () => mockGoogleMapInstance,
}));

import KebabMap from "@/components/KebabMap";
import KebabAdvancedMarker from "@/components/KebabAdvancedMarker";

describe("KebabMap & KebabAdvancedMarker runtime resilience", () => {
  const prevApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const prevDisablePaid = process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
  const prevMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  beforeEach(async () => {
    await resetLocalDbAdapterForTests();
    cleanup();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyLiveTestKeyForResilienceSpec";
    delete process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    mockSearchParamsValue = undefined;
    mockLoaderState = { isLoaded: false };
    mockGoogleMapShouldThrow = false;
    capturedLoaderOptions.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    if (prevApiKey === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = prevApiKey;
    }
    if (prevDisablePaid === undefined) {
      delete process.env.NEXT_PUBLIC_DISABLE_PAID_APIS;
    } else {
      process.env.NEXT_PUBLIC_DISABLE_PAID_APIS = prevDisablePaid;
    }
    if (prevMapId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = prevMapId;
    }
    delete (window as unknown as { google?: unknown }).google;
    delete (window as unknown as { gm_authFailure?: unknown }).gm_authFailure;
  });

  it("blocks DEMO_MAP_ID fallback when NODE_ENV is production and shows fallback card", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = "DEMO_MAP_ID";

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    expect(screen.getByText(/Map ID Google Maps di produzione non configurato/i)).toBeInTheDocument();
  });

  it("includes 'maps' in useJsApiLoader libraries and survives undefined searchParams", () => {
    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    expect(screen.getByText(/Caricamento Google Maps/i)).toBeInTheDocument();
    expect(capturedLoaderOptions[0]?.libraries).toEqual(["maps", "marker", "places"]);
  });

  it("strips accidental quotes and whitespace from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = '  "AIzaSyQuotedKeyInEnv"  ';

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    expect(capturedLoaderOptions[0]?.googleMapsApiKey).toBe("AIzaSyQuotedKeyInEnv");
  });

  it("renders fallback card on useJsApiLoader loadError and allows switching to Zero-Cost local view", () => {
    mockLoaderState = {
      isLoaded: false,
      loadError: new Error("The Google Maps JavaScript API could not load."),
    };

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    expect(screen.getByText(/Mappa Google non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/The Google Maps JavaScript API could not load\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Usa Esplorazione Locale/i }));
    expect(screen.getByTestId("zero-cost-map-view")).toBeInTheDocument();
  });

  it("switches to fallback card when window.gm_authFailure fires and lets user open local view", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (window as unknown as { google: unknown }).google = {
      maps: { Map: function MockMap() {} },
    };
    mockLoaderState = { isLoaded: true };

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    act(() => {
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
    });

    expect(screen.getByText(/Mappa Google non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/Autenticazione Google Maps rifiutata/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Usa Esplorazione Locale/i }));
    expect(screen.getByTestId("zero-cost-map-view")).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it("isolates GoogleMap render crashes inside MapSdkErrorBoundary", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (window as unknown as { google: unknown }).google = {
      maps: { Map: function MockMap() {} },
    };
    mockLoaderState = { isLoaded: true };
    mockGoogleMapShouldThrow = true;

    render(
      <ToastProvider>
        <KebabMap />
      </ToastProvider>
    );

    expect(screen.getByText(/Mappa Google non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/Cannot read properties of undefined \(reading 'get'\)/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it("does not throw in KebabAdvancedMarker when window.google.maps is undefined", () => {
    (window as unknown as { google: unknown }).google = {};

    expect(() =>
      render(<KebabAdvancedMarker position={{ lat: 45.46, lng: 9.19 }} />)
    ).not.toThrow();
  });

  it("survives position setter TypeError and cleanup errors in KebabAdvancedMarker", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    class ThrowingAdvancedMarkerElement {
      addEventListener() {}
      removeEventListener() {}
      set position(_val: unknown) {
        throw new TypeError("Cannot read properties of undefined (reading 'get')");
      }
      set map(_val: unknown) {
        throw new Error("cleanup map failure");
      }
    }

    (window as unknown as { google: unknown }).google = {
      maps: {
        marker: {
          AdvancedMarkerElement: ThrowingAdvancedMarkerElement,
        },
      },
    };

    const { rerender, unmount } = render(
      <KebabAdvancedMarker position={{ lat: 45.46, lng: 9.19 }} />
    );

    expect(() => {
      rerender(<KebabAdvancedMarker position={{ lat: 45.47, lng: 9.2 }} />);
    }).not.toThrow();

    expect(() => {
      unmount();
    }).not.toThrow();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("allows wasm-unsafe-eval and excludes unsafe-eval in production CSP", async () => {
    const nextConfigMod = await import("../../../../next.config.mjs");
    const nextConfig = nextConfigMod.default as {
      headers?: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
    };
    const headerRules = await nextConfig.headers?.();
    const rootRule = headerRules?.find((r) => r.source === "/(.*)");
    const csp = rootRule?.headers.find((h) => h.key === "Content-Security-Policy")?.value || "";
    const scriptSrcDirective = csp
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("script-src "));

    expect(scriptSrcDirective).toBeDefined();
    expect(scriptSrcDirective).toContain("'wasm-unsafe-eval'");
    expect(scriptSrcDirective).not.toContain("'unsafe-eval'");

    const nextConfigRaw = fs.readFileSync(path.resolve(process.cwd(), "next.config.mjs"), "utf8");
    expect(nextConfigRaw).toContain("'wasm-unsafe-eval'");
  });
});
