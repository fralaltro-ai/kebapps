import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportEmailGate } from "@/components/support/SupportEmailGate";

let mockResolvedTheme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme }),
}));

describe("SupportEmailGate", () => {
  const originalEnv = process.env;
  let capturedOptions: {
    sitekey?: string;
    action?: string;
    size?: string;
    theme?: string;
    execution?: string;
    appearance?: string;
    callback?: (token: string) => void;
    "error-callback"?: (errorCode?: string) => void;
    "expired-callback"?: () => void;
  } | null = null;
  let mockRender: ReturnType<typeof vi.fn>;
  let mockReset: ReturnType<typeof vi.fn>;
  let mockRemove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_TURNSTILE_SUPPORT_SITE_KEY: "0x4AAAAAAA_support_test_key",
    };
    mockResolvedTheme = "light";
    capturedOptions = null;

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    mockRender = vi.fn((_container, options) => {
      capturedOptions = options;
      return "support-widget-1";
    });
    mockReset = vi.fn();
    mockRemove = vi.fn();

    window.turnstile = {
      render: mockRender as unknown as NonNullable<Window["turnstile"]>["render"],
      execute: vi.fn() as unknown as NonNullable<Window["turnstile"]>["execute"],
      reset: mockReset as unknown as NonNullable<Window["turnstile"]>["reset"],
      remove: mockRemove as unknown as NonNullable<Window["turnstile"]>["remove"],
    };
  });

  afterEach(() => {
    cleanup();
    process.env = originalEnv;
    delete window.turnstile;
    document.querySelectorAll("script[data-kebapp-turnstile]").forEach((s) => s.remove());
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not expose email, mailto:, forms, or Turnstile widgets before explicit click", () => {
    const { container } = render(<SupportEmailGate variant="card" />);

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.textContent).not.toContain("support@kebapps.app");
    expect(screen.getByTestId("support-unlock-trigger")).toBeInTheDocument();
    expect(mockRender).not.toHaveBeenCalled();
    expect(document.querySelector("script[data-kebapp-turnstile]")).toBeNull();

    cleanup();
    const inline = render(<SupportEmailGate variant="inline" />);
    expect(inline.container.querySelector("form")).toBeNull();
    expect(inline.container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(inline.container.textContent).not.toContain("support@kebapps.app");
  });

  it("blocks Turnstile loading when offline and allows retrying once back online", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<SupportEmailGate variant="card" />);
    fireEvent.click(screen.getByTestId("support-unlock-trigger"));

    expect(screen.getByTestId("support-offline-notice")).toBeInTheDocument();
    expect(mockRender).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    fireEvent.click(screen.getByTestId("support-retry-btn"));
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1);
    });
  });

  it("renders visible Managed Turnstile on click, calls /api/support-contact, unlocks mailto & clipboard copy", async () => {
    mockResolvedTheme = "dark";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: "support@kebapps.app",
        subject: "[KebApps] Supporto / Segnalazione",
        source: "live",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(<SupportEmailGate variant="card" />);
    fireEvent.click(screen.getByTestId("support-unlock-trigger"));

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1);
    });
    expect(capturedOptions).toMatchObject({
      sitekey: "0x4AAAAAAA_support_test_key",
      action: "support_contact",
      size: "flexible",
      theme: "dark",
      execution: "render",
      appearance: "always",
    });

    await act(async () => {
      capturedOptions?.callback?.("cf-visible-token");
    });

    await waitFor(() => {
      expect(screen.getByTestId("support-unlocked-email")).toHaveTextContent("support@kebapps.app");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support-contact",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: { "x-turnstile-token": "cf-visible-token" },
      })
    );

    const mailto = screen.getByTestId("support-mailto-link");
    expect(mailto).toHaveAttribute(
      "href",
      "mailto:support@kebapps.app?subject=%5BKebApps%5D%20Supporto%20%2F%20Segnalazione"
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("support-copy-email-btn"));
    });
    expect(writeTextMock).toHaveBeenCalledWith("support@kebapps.app");
    expect(screen.getByTestId("support-copy-email-btn")).toHaveTextContent("Copiato");
  });

  it("shows error notice and Retry button without leaking email when server rejects verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Verifica anti-bot fallita." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupportEmailGate variant="inline" />);
    fireEvent.click(screen.getByTestId("support-unlock-trigger"));

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      capturedOptions?.callback?.("rejected-token");
    });

    await waitFor(() => {
      expect(screen.getByTestId("support-error-notice")).toHaveTextContent(
        "Verifica anti-bot fallita."
      );
    });
    expect(screen.queryByTestId("support-mailto-link")).toBeNull();
    expect(screen.getByTestId("support-retry-btn")).toBeInTheDocument();
  });

  it("uses dev-turnstile-bypass outside production when support site key is empty", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.NEXT_PUBLIC_TURNSTILE_SUPPORT_SITE_KEY = "";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: "support@kebapps.app",
        subject: "[KebApps] Supporto / Segnalazione",
        source: "dev_fallback",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupportEmailGate variant="card" />);
    fireEvent.click(screen.getByTestId("support-unlock-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("support-mailto-link")).toHaveAttribute(
        "href",
        expect.stringMatching(/^mailto:/)
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support-contact",
      expect.objectContaining({
        headers: { "x-turnstile-token": "dev-turnstile-bypass" },
      })
    );
  });
});
