import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisualViewportOffset } from "../useVisualViewportOffset";

describe("useVisualViewportOffset", () => {
  const originalVisualViewport = window.visualViewport;
  const originalInnerHeight = window.innerHeight;
  let vvListeners: Map<string, Set<() => void>>;
  let mockVvHeight = 800;

  beforeEach(() => {
    vvListeners = new Map();
    mockVvHeight = 800;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      Promise.resolve().then(() => cb(0));
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, "visualViewport", {
      value: {
        get height() {
          return mockVvHeight;
        },
        offsetTop: 0,
        addEventListener: (ev: string, fn: () => void) => {
          const set = vvListeners.get(ev) ?? new Set();
          set.add(fn);
          vvListeners.set(ev, set);
        },
        removeEventListener: (ev: string, fn: () => void) => {
          vvListeners.get(ev)?.delete(fn);
        },
      },
      configurable: true,
    });

    document.documentElement.style.removeProperty("--vv-offset");
  });

  afterEach(() => {
    delete (document as { activeElement?: Element | null }).activeElement;
    document.body.innerHTML = "";
    Object.defineProperty(window, "visualViewport", {
      value: originalVisualViewport,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      configurable: true,
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const emitVv = (event: string) => {
    vvListeners.get(event)?.forEach((fn) => fn());
  };

  it("keeps keyboardOpen false and never sets --vv-offset when visualViewport shrinks during non-input scroll", async () => {
    const { result } = renderHook(() => useVisualViewportOffset());
    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.offset).toBe(0);

    await act(async () => {
      mockVvHeight = 580;
      emitVv("resize");
      await Promise.resolve();
    });

    expect(result.current.keyboardOpen).toBe(false);
    expect(result.current.offset).toBe(0);
    expect(document.documentElement.style.getPropertyValue("--vv-offset")).toBe("");
  });

  it("sets keyboardOpen true only when a text input is focused and viewport shrinks > 150px, resetting on focusout", async () => {
    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);

    const { result } = renderHook(() => useVisualViewportOffset());

    await act(async () => {
      Object.defineProperty(document, "activeElement", {
        value: input,
        configurable: true,
      });
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      mockVvHeight = 500;
      emitVv("resize");
      await Promise.resolve();
    });

    expect(result.current.keyboardOpen).toBe(true);

    await act(async () => {
      Object.defineProperty(document, "activeElement", {
        value: document.body,
        configurable: true,
      });
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      mockVvHeight = 800;
      emitVv("resize");
      await Promise.resolve();
    });

    expect(result.current.keyboardOpen).toBe(false);
  });
});
