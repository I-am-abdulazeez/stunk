import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { paginatedAsyncChunk } from "../src/query/async-chunk";
import { useAsyncChunk } from "../src/use-react/hooks/use-async-chunk";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function TestConsumer({ chunk, label }: { chunk: any; label: string }) {
  const { data, pagination, nextPage } = useAsyncChunk(chunk);
  return (
    <div>
      <span data-testid={`${label}-page`}>{pagination?.page ?? "n/a"}</span>
      <span data-testid={`${label}-data`}>{JSON.stringify(data)}</span>
      <button data-testid={`${label}-next`} onClick={() => nextPage()}>
        next
      </button>
    </div>
  );
}

describe("useAsyncChunk — scoped resolution", () => {
  it("should give each component its own instance for a scoped chunk", async () => {
    let fetchCount = 0;

    const sharedExport = paginatedAsyncChunk(
      async ({ page, pageSize }: { page: number; pageSize: number }) => {
        fetchCount++;
        return { data: [`page-${page}`], hasMore: true };
      },
      {
        pagination: { pageSize: 10, mode: "replace" },
        scoped: true,
      } as any,
    );

    render(
      <>
        <TestConsumer chunk={sharedExport} label="a" />
        <TestConsumer chunk={sharedExport} label="b" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("a-data").textContent).toContain("page-1");
      expect(screen.getByTestId("b-data").textContent).toContain("page-1");
    });

    // Advance only consumer A to page 2
    await act(async () => {
      screen.getByTestId("a-next").click();
      await delay(50);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("2");
      // B must remain on page 1 — independent instance, not shared state
      expect(screen.getByTestId("b-page").textContent).toBe("1");
    });
  });

  it("should share state across components for a non-scoped chunk", async () => {
    let fetchCount = 0;

    const sharedExport = paginatedAsyncChunk(
      async ({ page, pageSize }: { page: number; pageSize: number }) => {
        fetchCount++;
        return { data: [`page-${page}`], hasMore: true };
      },
      { pagination: { pageSize: 10, mode: "replace" } },
    );

    render(
      <>
        <TestConsumer chunk={sharedExport} label="a" />
        <TestConsumer chunk={sharedExport} label="b" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("1");
      expect(screen.getByTestId("b-page").textContent).toBe("1");
    });

    await act(async () => {
      screen.getByTestId("a-next").click();
      await delay(50);
    });

    // Both consumers observe the same underlying chunk — B updates too
    await waitFor(() => {
      expect(screen.getByTestId("a-page").textContent).toBe("2");
      expect(screen.getByTestId("b-page").textContent).toBe("2");
    });
  });
});
