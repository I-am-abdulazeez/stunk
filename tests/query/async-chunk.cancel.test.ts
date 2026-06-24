import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { asyncChunk } from "../../src/query/async-chunk";

describe("asyncChunk.cancel()", () => {
  it("cancels in-flight request and sets loading to false", async () => {
    let resolveRequest!: (value: string) => void;
    const slowFetcher = vi.fn(
      (params: { id: string }) =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        })
    );

    const chunk = asyncChunk(slowFetcher, {});

    // setParams triggers fetch — this is how param chunks start loading
    chunk.setParams({ id: "1" });
    expect(chunk.get().loading).toBe(true);

    // Cancel before it resolves
    chunk.cancel();
    expect(chunk.get().loading).toBe(false);
    expect(chunk.get().data).toBe(null);

    // Resolve the dangling promise — data should NOT be set due to isCancelled flag
    resolveRequest("done");
    await new Promise((r) => setTimeout(r, 0));

    expect(chunk.get().data).toBe(null);
  });

  it("does nothing if no request is in flight", () => {
    const chunk = asyncChunk(
      (params: { id: string }) => Promise.resolve("hello"),
      {}
    );
    expect(() => chunk.cancel()).not.toThrow();
    expect(chunk.get().loading).toBe(false);
  });

  it("allows fetch after cancel", async () => {
    let callCount = 0;
    const fetcher = vi.fn(async (params: { id: string }) => {
      callCount++;
      return `result-${callCount}`;
    });

    const chunk = asyncChunk(fetcher, {});

    chunk.setParams({ id: "1" });
    chunk.cancel();
    expect(chunk.get().loading).toBe(false);

    // Should be able to fetch again after cancel
    chunk.setParams({ id: "1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(chunk.get().data).toBe("result-2");
    expect(chunk.get().loading).toBe(false);
  });
});

describe("useAsyncChunk enabled flipping false", () => {
  it("calls cancel when enabled flips from true to false", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useAsyncChunk } = await import(
      "../../src/use-react/hooks/use-async-chunk"
    );

    let resolveRequest!: (value: string) => void;
    const slowFetcher = vi.fn(
      (params: { ref: string }) =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        })
    );

    const chunk = asyncChunk(slowFetcher, {});
    const cancelSpy = vi.spyOn(chunk, "cancel");

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAsyncChunk(chunk, {
          enabled,
          params: { ref: "JOB123" },
        }),
      { initialProps: { enabled: true } }
    );

    // Wait for initial setParams to fire
    await act(async () => { });
    expect(chunk.get().loading).toBe(true);

    // Flip enabled to false
    act(() => {
      rerender({ enabled: false });
    });

    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(chunk.get().loading).toBe(false);

    // Resolve dangling — data must NOT be set
    resolveRequest("done");
    await act(async () => { });
    expect(chunk.get().data).toBe(null);
  });

  it("reloads when enabled flips from false to true", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useAsyncChunk } = await import(
      "../../src/use-react/hooks/use-async-chunk"
    );

    const fetcher = vi.fn(async (params: { ref: string }) => "hello");
    const chunk = asyncChunk(fetcher, {});

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAsyncChunk(chunk, {
          enabled,
          params: { ref: "JOB123" },
        }),
      { initialProps: { enabled: false } }
    );

    // Should not have fetched yet
    expect(fetcher).not.toHaveBeenCalled();

    // Flip to true
    await act(async () => {
      rerender({ enabled: true });
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(chunk.get().data).toBe("hello");
  });
});

describe("enabled: isOpen modal pattern", () => {
  it("does not fetch when modal is closed (enabled: false)", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useAsyncChunk } = await import(
      "../../src/use-react/hooks/use-async-chunk"
    );

    const fetcher = vi.fn(async (params: { ref: string }) => ({
      companies: [],
    }));

    const chunk = asyncChunk(fetcher, {});

    const { result } = renderHook(() =>
      useAsyncChunk(chunk, {
        enabled: false,
        params: { ref: "JOB123" },
      })
    );

    await act(async () => { });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
  });

  it("fetches when modal opens, stops when closed", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useAsyncChunk } = await import(
      "../../src/use-react/hooks/use-async-chunk"
    );

    let resolveRequest!: (value: any) => void;
    const fetcher = vi.fn(
      (params: { ref: string }) =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const chunk = asyncChunk(fetcher, {});

    const { rerender, result } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useAsyncChunk(chunk, {
          enabled: isOpen,
          params: { ref: "JOB123" },
        }),
      { initialProps: { isOpen: false } }
    );

    // Closed — no fetch
    await act(async () => { });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    // Open modal — should fetch
    await act(async () => {
      rerender({ isOpen: true });
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(true);

    // Close modal — should cancel
    act(() => {
      rerender({ isOpen: false });
    });
    expect(result.current.loading).toBe(false);

    // Resolve late — data must NOT be set
    resolveRequest({ companies: [{ id: "1" }] });
    await act(async () => { });
    expect(chunk.get().data).toBe(null);

    // No additional fetches after close
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
