import { describe, expect, it } from "vitest";
import { computed } from "../../dist/index.js";
import { asyncChunk } from "../../dist/query/index.js";

// Exercises the compiled dist/ output, not src/ — this bug is a bundling
// artifact that's invisible when testing against source files directly
// (vite/vitest resolve every import of core/core.ts to one module instance
// regardless of which file does the importing). Run `pnpm build` first.
describe("cross-entry dependency tracking (build artifact integrity)", () => {
  it("computed() from the root entry tracks a dependency on a chunk created via stunk/query", async () => {
    const source = asyncChunk(async () => "hello");

    // let the initial fetch resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    const derived = computed(() => source.get().data);
    expect(derived.get()).toBe("hello");

    let received: unknown;
    derived.subscribe((value) => {
      received = value;
    });

    source.mutate(() => "updated");

    expect(derived.get()).toBe("updated");
    expect(received).toBe("updated");
  });
});
