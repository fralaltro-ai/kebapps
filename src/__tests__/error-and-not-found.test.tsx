import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { expect, test, vi, describe, afterEach } from "vitest";
import ErrorPage from "../app/error";
import GlobalError from "../app/global-error";
import NotFound from "../app/not-found";

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Quicksand: () => ({
    variable: "--font-sans",
  }),
}));

afterEach(() => {
  cleanup();
});

describe("Error Handling Components", () => {
  describe("ErrorPage (app/error.tsx)", () => {
    test("renders error title, message and allows retry", () => {
      const resetMock = vi.fn();
      const mockError = new Error("Spiedo bloccato");
      (mockError as Error & { digest?: string }).digest = "TEST_DIGEST_123";

      render(<ErrorPage error={mockError} reset={resetMock} />);

      expect(screen.getByText(/Ops! Lo spiedo si è inceppato/i)).toBeInTheDocument();
      expect(screen.getByText(/Intoppo sulla Griglia/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /Riprova subito/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(resetMock).toHaveBeenCalledTimes(1);

      // Expand diagnostics
      const detailsBtn = screen.getByRole("button", { name: /Dettagli tecnici per l'assistenza/i });
      fireEvent.click(detailsBtn);
      expect(screen.getByText(/TEST_DIGEST_123/i)).toBeInTheDocument();
      expect(screen.getByText(/Spiedo bloccato/i)).toBeInTheDocument();
    });
  });

  describe("GlobalError (app/global-error.tsx)", () => {
    test("renders critical error and triggers reset", () => {
      const resetMock = vi.fn();
      const mockError = new Error("Crash catastrofico");

      render(<GlobalError error={mockError} reset={resetMock} />);

      expect(screen.getByText(/La griglia si è spenta del tutto!/i)).toBeInTheDocument();
      expect(screen.getByText(/Errore Critico del Sistema/i)).toBeInTheDocument();

      const resetBtn = screen.getByRole("button", { name: /Riavvia Griglia/i });
      fireEvent.click(resetBtn);
      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("NotFound (app/not-found.tsx)", () => {
    test("renders 404 page with navigation links", () => {
      render(<NotFound />);

      expect(screen.getByText(/Kebab non trovato!/i)).toBeInTheDocument();
      expect(screen.getByText(/Errore 404/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Torna alla Home/i })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: /Mappa Locali/i })).toHaveAttribute("href", "/map");
    });
  });
});
