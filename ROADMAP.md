# Stunk - Development Roadmap 🚧

> **Current Status**: 110+ GitHub stars | 3.32kb gzipped (core + React + Query) | v3.0.0-alpha.2

---

## ✅ v3.0.0 — Shipped (alpha.2)

### Core

- `peek()` — read without tracking dependencies
- `strict` mode — throws or warns on unknown keys in `set()` in dev
- `null` as a valid chunk value (was forbidden in v2)
- `ReadOnlyChunk<T>` — `derive()` now returns a proper read-only type
- `trackDependencies` — exported for building custom reactive primitives
- `validateObjectShape` — smarter dev warnings, ignores `undefined → T` and `T → null` transitions
- `batch()` — nested batches, no duplicate notifications, error-safe

### Computed (redesigned ✅)

- Auto dependency tracking via `.get()` calls — no dependency arrays
- Lazy evaluation with eager recompute when subscribers are active
- `isDirty()` and `recompute()` for manual control
- `peek()` does not create dependencies
- Diamond dependency pattern handled correctly — no double notifications
- `derive()` freshness fixed — no stale values through derived chains
- `subscriberCount` ref-counting — no negative counts

### Query (new subpath `stunk/query` ✅)

- `asyncChunk` — full async state with loading, error, data, lastFetched
- `infiniteAsyncChunk` — accumulate mode, infinite scroll ready
- `combineAsyncChunks` — unified loading/error/data across multiple chunks
- Request deduplication via `key` option
- `keepPreviousData` + `isPlaceholderData` — no UI flicker on param changes
- `onSuccess` / `onError` callbacks
- `enabled` as boolean or function — dynamic disabling
- `setParams` with null clearing, `clearParams()`
- `refetchOnWindowFocus`, `refetchInterval`, `staleTime`, `cacheTime`
- `forceCleanup()` + ref-counted `cleanup()`
- Full pagination — `nextPage`, `prevPage`, `goToPage`, `resetPagination`
- SSR-safe — all `window` access guarded

### React hooks (updated ✅)

- `useAsyncChunk` — single effect, Rules of Hooks compliant, exposes `isPlaceholderData` and `clearParams`
- `useInfiniteAsyncChunk` — stable `IntersectionObserver`, SSR-safe, correct `isFetchingMore`

### Middleware (updated ✅)

- `history` → renamed, `reset()` now clears history stack, `skipDuplicates: true` vs `'shallow'` distinction fixed
- `persist` → `clearStorage()` added, `onError` called on type mismatch, array vs object type mismatch detection, dead `isInitializing` flag removed

### Build & Package

- `stunk/query` subpath export added to `package.json` and `tsup.config.ts`
- `__DEV__` correctly set per bundle — `false` in core, `true` in subpath entries
- Total bundle: ~9.57 KB ESM core, query is fully tree-shakeable

### Tests (70+ passing across 9 files)

- `chunk.test.ts` — 31 tests
- `batch-chunk.test.ts` — 7 tests
- `select.test.ts` — 21 tests
- `computed.test.ts` — 28 tests
- `history.test.ts` — 17 tests
- `persist.test.ts` — 20 tests
- `async-chunk.test.ts` — 41 tests
- `infinite-async-chunk.test.ts` — 21 tests
- `combine-async-chunks.test.ts` — 8 tests

---

## 🚧 In Progress

### Docs update for v3 — stunk.dev

- All new options documented (`key`, `onSuccess`, `keepPreviousData`, `clearParams`, `forceCleanup`, `strict`, `enabled` as function)
- v2 docs preserved at `v2.stunk.dev`
- Changelog updated

### React hook tests

- `useAsyncChunk` — needs `@testing-library/react` setup
- `useInfiniteAsyncChunk` — needs `IntersectionObserver` mock

---

## 📋 Planned — v3.0.0 stable

### Vue composables completion

- `useChunk`, `useChunkValue`, `useAsyncChunk` for Vue 3
- SSR compatibility for Nuxt
- Re-enable `use-vue/index` in `tsup.config.ts`

### Middleware tests

- `logger` and `nonNegativeValidator` dedicated test file

### `select` + `computed` docs update

- Document `peek()` dependency tracking behaviour
- Document `strict` mode

---

## 📋 Planned — v3.1.0

### Svelte integration

- Native stores compatibility
- Leverage lessons from Vue integration

### Performance benchmarks

- Benchmark against Zustand, Jotai, Valtio, Pinia
- Quantify bundle size and runtime advantages

### DevTools (research phase)

- Browser extension scope and requirements
- Time-travel debugging via `history` middleware
- Dependency graph visualization

---

## 📋 Long-term (v4+)

### Power user features

- Lazy chunks — compute only when accessed
- Chunk collections — arrays/maps of chunks with bulk operations
- Transactions — multi-chunk atomic updates with rollback
- Plugin ecosystem and middleware registry

### Ecosystem

- ESLint rules for Stunk best practices
- VS Code extension with snippets
- Form library integrations (React Hook Form, Formik)
- WebSocket / real-time data sync patterns

---

## Success Metrics

### Technical ✅

- Bundle size: 3.32kb gzipped (core + React + Query) — on target
- 70+ tests, all passing
- Full TypeScript coverage
- SSR safe across all APIs

### Community 🚀

#### GitHub Stars

- Current (March 2026): 110+ stars
- April 25 — conference: 200+ stars (pre-conference push + v3 stable release)
- May 2026 — post-conference: 400+ stars
- January 2027 (2 year mark): 1000+ stars

#### NPM Downloads

- Current weekly: ~278 (278 total, base ~50-80 organic/week)
- Pre-conference target: 500+ weekly
- Post-conference target: 1000+ weekly consistently
- Key milestone: first 0 → 1 dependent (someone building on top of Stunk)

#### Actions before April 25

- Ship v3 stable — alpha versions don't get organic downloads
- Update NPM README — first thing people see
- Investigate what drove the v2.7.1 spike (264 downloads in one week) and replicate it
- Publish one technical article on the query layer — the key v3 differentiator
- stunk.dev live with v3 docs before the conference

### Key Differentiators (v3)

- Smallest bundle with async-first query layer built in
- Framework-agnostic core, first-class React, Vue coming
- Dev-mode shape validation — unique to Stunk
- Request deduplication without query keys
- `peek()` for non-reactive reads — fine-grained control
