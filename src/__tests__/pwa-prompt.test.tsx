import React from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PwaPrompt from "../components/ui/PwaPrompt";
import { PWA_KEYS, PWA_SNOOZE_MS } from "@/lib/pwa-utils";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const PIXEL_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

function mockMatchMedia(standaloneMatches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("display-mode: standalone") ? standaloneMatches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setUserAgent(ua: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
}

function markOnboardingSeen() {
  localStorage.setItem(PWA_KEYS.ONBOARDING_SEEN, "true");
}

function setSessionCount(n: number) {
  localStorage.setItem(PWA_KEYS.SESSIONS, String(n));
}

describe("PwaPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockPathname = "/";
    mockMatchMedia(false);
    setUserAgent(PIXEL_CHROME_UA);
    window.__kebappDeferredPrompt = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nothing when running standalone (installed PWA / TWA)", async () => {
    mockMatchMedia(true);
    markOnboardingSeen();
    setSessionCount(3);
    render(<PwaPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when onboarding has not been seen yet", async () => {
    setSessionCount(3);
    render(<PwaPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing during the first session (session count below threshold)", async () => {
    markOnboardingSeen();
    render(<PwaPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing while a snooze window is active", async () => {
    markOnboardingSeen();
    setSessionCount(5);
    localStorage.setItem(PWA_KEYS.DISMISSED_UNTIL, String(Date.now() + 1000));
    render(<PwaPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the Android manual fallback instructions when no deferred install prompt is available", async () => {
    markOnboardingSeen();
    setSessionCount(3);
    render(<PwaPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/tre puntini/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ho capito/i })).toBeInTheDocument();
  });

  it("snoozes for ~7 days when the close button is clicked", async () => {
    markOnboardingSeen();
    setSessionCount(3);
    render(<PwaPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const before = Date.now();

    const closeButton = screen.getByRole("button", { name: /chiudi suggerimento installazione/i });
    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const stored = Number(localStorage.getItem(PWA_KEYS.DISMISSED_UNTIL));
    expect(stored).toBeGreaterThanOrEqual(before + PWA_SNOOZE_MS - 1000);
    expect(stored).toBeLessThanOrEqual(before + PWA_SNOOZE_MS + 5000);
  });

  it.each(["/privacy-policy", "/cookie-policy", "/terms", "/~offline"])(
    "renders nothing and does not increment kebapp_sessions on %s",
    async (excludedPath) => {
      mockPathname = excludedPath;
      markOnboardingSeen();
      render(<PwaPrompt />);

      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(localStorage.getItem(PWA_KEYS.SESSIONS)).toBeNull();
    }
  );
});
