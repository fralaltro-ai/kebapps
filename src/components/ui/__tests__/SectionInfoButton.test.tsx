import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { SectionInfoButton } from "../SectionInfoButton";

describe("SectionInfoButton", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    title: "Kebab Index",
    subtitle: "Misura quanto sono complete le tue schede.",
    items: [
      { label: "Base (50%)", description: "Voto carne, pane, salse e qualità/prezzo." },
      { label: "Location (25%)", description: "Voto sull'esperienza del locale." },
      { label: "Note (25%)", description: "Dettagli o appunti personali." },
    ],
    footerNote: "Tutti i dati rimangono nel dispositivo.",
  };

  it("renders trigger button with correct aria-label and testId", () => {
    render(<SectionInfoButton {...defaultProps} testId="info-trigger" />);

    const trigger = screen.getByTestId("info-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-label", "Informazioni su Kebab Index");
  });

  it("opens portal dialog on trigger click with role='dialog' and aria-modal='true'", () => {
    render(<SectionInfoButton {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: "Informazioni su Kebab Index" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    expect(screen.getByRole("heading", { name: "Kebab Index" })).toBeInTheDocument();
    expect(screen.getByText("Misura quanto sono complete le tue schede.")).toBeInTheDocument();
    expect(screen.getByText("Base (50%)")).toBeInTheDocument();
    expect(screen.getByText("Voto carne, pane, salse e qualità/prezzo.")).toBeInTheDocument();
    expect(screen.getByText("Location (25%)")).toBeInTheDocument();
    expect(screen.getByText("Note (25%)")).toBeInTheDocument();
    expect(screen.getByText("Tutti i dati rimangono nel dispositivo.")).toBeInTheDocument();
  });

  it("closes modal on close button click ('Chiudi informazioni')", () => {
    render(<SectionInfoButton {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Informazioni su Kebab Index" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Chiudi informazioni" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on Escape key press", () => {
    render(<SectionInfoButton {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Informazioni su Kebab Index" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on backdrop click without closing on dialog inner card click", () => {
    render(<SectionInfoButton {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Informazioni su Kebab Index" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click inside card (e.g. on subtitle text)
    fireEvent.click(screen.getByText("Misura quanto sono complete le tue schede."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click on backdrop (element with aria-hidden="true" inside the dialog)
    const backdrop = document.querySelector(".fixed.inset-0.bg-neutral-950\\/65");
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
