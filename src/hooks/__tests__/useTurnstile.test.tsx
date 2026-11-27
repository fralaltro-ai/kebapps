import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTurnstile } from "@/hooks/useTurnstile";

describe("useTurnstile", () => {
  let latestExecute: (() => Promise<string>) | null = null;
  let capturedOptions: {
    sitekey?: string;
    size?: string;
    theme?: string;
    execution?: string;
    appearance?: string;
    callback?: (token: string) => void;
    "error-callback"?: () => void;
    "expired-callback"?: () => void;
  } | null = null;
  let mockRender: ReturnType<typeof vi.fn>;
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockReset: ReturnType<typeof vi.fn>;
  let mockRemove: ReturnType<typeof vi.fn>;

  function Harness() {
    const { containerRef, execute } = useTurnstile({
      action: "shops_search",
      execution: "execute",
    });
    latestExecute = execute;
    return <div ref={containerRef} />;
  }

  beforeEach(() => {
    latestExecute = null;
    capturedOptions = null;

    mockRender = vi.fn((_container, options) => {
      capturedOptions = options;
      return "widget-1";
    });
    mockExecute = vi.fn();
    mockReset = vi.fn();
    mockRemove = vi.fn();

    window.turnstile = {
      render: mockRender as unknown as NonNullable<Window["turnstile"]>["render"],
      execute: mockExecute as unknown as NonNullable<Window["turnstile"]>["execute"],
      reset: mockReset as unknown as NonNullable<Window["turnstile"]>["reset"],
      remove: mockRemove as unknown as NonNullable<Window["turnstile"]>["remove"],
    };
  });

  afterEach(() => {
    cleanup();
    delete window.turnstile;
  });

  it("calls reset() before re-executing an already executed widget", async () => {
    render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRender).toHaveBeenCalledTimes(1);

    let firstPromise: Promise<string>;
    await act(async () => {
      firstPromise = latestExecute!();
    });

    expect(mockReset).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledTimes(1);

    act(() => {
      capturedOptions?.callback?.("token-1");
    });
    await expect(firstPromise!).resolves.toBe("token-1");

    let secondPromise: Promise<string>;
    await act(async () => {
      secondPromise = latestExecute!();
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith("widget-1");
    expect(mockExecute).toHaveBeenCalledTimes(2);

    act(() => {
      capturedOptions?.callback?.("token-2");
    });
    await expect(secondPromise!).resolves.toBe("token-2");
  });

  it("serializes concurrent execute() calls instead of executing in parallel", async () => {
    render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    let p1!: Promise<string>;
    let p2!: Promise<string>;
    await act(async () => {
      p1 = latestExecute!();
      p2 = latestExecute!();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);

    await act(async () => {
      capturedOptions?.callback?.("token-a");
    });
    await expect(p1).resolves.toBe("token-a");

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(2);

    await act(async () => {
      capturedOptions?.callback?.("token-b");
    });
    await expect(p2).resolves.toBe("token-b");
  });

  it("resets quietly on idle expired-callback without calling execute() in background", async () => {
    render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRender).toHaveBeenCalledTimes(1);

    act(() => {
      capturedOptions?.["expired-callback"]?.();
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith("widget-1");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("supports custom siteKey, flexible size, and render-mode verify/expire/error callbacks", async () => {
    const onVerify = vi.fn();
    const onExpire = vi.fn();
    const onError = vi.fn();

    function VisibleHarness() {
      const { containerRef } = useTurnstile({
        action: "support_contact",
        siteKey: "custom-visible-site-key",
        size: "flexible",
        theme: "dark",
        execution: "render",
        appearance: "always",
        onVerify,
        onExpire,
        onError,
      });
      return <div ref={containerRef} />;
    }

    render(<VisibleHarness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toMatchObject({
      sitekey: "custom-visible-site-key",
      size: "flexible",
      theme: "dark",
      execution: "render",
      appearance: "always",
    });

    act(() => {
      capturedOptions?.callback?.("visible-token");
    });
    expect(onVerify).toHaveBeenCalledWith("visible-token");

    act(() => {
      capturedOptions?.["expired-callback"]?.();
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith("widget-1");

    // First error performs one transparent reset; second error invokes onError.
    act(() => {
      capturedOptions?.["error-callback"]?.();
    });
    expect(onError).not.toHaveBeenCalled();

    act(() => {
      capturedOptions?.["error-callback"]?.();
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
