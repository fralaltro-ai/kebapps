import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShareModal } from "../components/ui/ShareModal";
import ShareButton from "../components/ui/ShareButton";

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ success: mockSuccess, error: mockError, toast: vi.fn() }),
}));

const mockHaptic = vi.fn();
vi.mock("@/lib/haptics", () => ({
  triggerHaptic: (...args: unknown[]) => mockHaptic(...args),
}));

describe("ShareModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("does not render when isOpen is false", () => {
    render(<ShareModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with correct a11y attributes and focuses the close button", async () => {
    render(<ShareModal isOpen={true} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "share-modal-title");
    expect(screen.getByText("Condividi KebApps")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Chiudi condivisione")).toHaveFocus();
    });
  });

  it("triggers haptic feedback on open", () => {
    render(<ShareModal isOpen={true} onClose={vi.fn()} />);
    expect(mockHaptic).toHaveBeenCalledWith("light");
  });

  it("shows the active PWA web share channel", () => {
    render(<ShareModal isOpen={true} onClose={vi.fn()} />);

    const webButton = screen.getByRole("button", { name: /Sito Web \(PWA\)/i });
    expect(webButton).not.toBeDisabled();
    expect(screen.queryByText(/Google Play Store/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apple App Store/i)).not.toBeInTheDocument();
  });

  it("closes on ESC key", () => {
    const onClose = vi.fn();
    render(<ShareModal isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<ShareModal isOpen={true} onClose={onClose} />);
    // Modal is portaled to document.body, so query it directly rather than via RTL's container.
    const backdrop = document.body.querySelector(".bg-neutral-950\\/65");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on close button click", () => {
    const onClose = vi.fn();
    render(<ShareModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Chiudi condivisione"));
    expect(onClose).toHaveBeenCalled();
  });

  it("uses navigator.share when available and closes the modal on success", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: mockShare, configurable: true });
    const onClose = vi.fn();

    render(<ShareModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Sito Web \(PWA\)/i }));

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "KebApps",
          text: expect.stringContaining("Scopri i migliori Kebab vicino a te su KebApps"),
        })
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when navigator.share is unavailable", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: mockWriteText }, configurable: true });

    render(<ShareModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sito Web \(PWA\)/i }));

    await waitFor(() => expect(mockWriteText).toHaveBeenCalled());
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith("Link copiato negli appunti! 🔥"));
  });

  it("does not show any feedback when the user cancels the native share sheet (AbortError)", async () => {
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    const mockShare = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, "share", { value: mockShare, configurable: true });
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: mockWriteText }, configurable: true });
    const onClose = vi.fn();

    render(<ShareModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Sito Web \(PWA\)/i }));

    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when navigator.share rejects with a non-abort error", async () => {
    const genericError = new Error("share failed");
    const mockShare = vi.fn().mockRejectedValue(genericError);
    Object.defineProperty(navigator, "share", { value: mockShare, configurable: true });
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: mockWriteText }, configurable: true });

    render(<ShareModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sito Web \(PWA\)/i }));

    await waitFor(() => expect(mockWriteText).toHaveBeenCalled());
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith("Link copiato negli appunti! 🔥"));
  });

  it("shows an error toast when clipboard write fails", async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: mockWriteText }, configurable: true });

    render(<ShareModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sito Web \(PWA\)/i }));

    await waitFor(() => expect(mockError).toHaveBeenCalledWith("Impossibile copiare il link"));
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});

describe("ShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the ShareModal on click and triggers haptic feedback", async () => {
    render(<ShareButton />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Condividi KebApps" }));

    expect(mockHaptic).toHaveBeenCalledWith("light");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("closes the modal when the close button is clicked", async () => {
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: "Condividi KebApps" }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByLabelText("Chiudi condivisione"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
