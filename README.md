# Stunk

Stunk is a lightweight, framework-agnostic state management library built on atomic state principles. Break state into independent **chunks** — each one reactive, composable, and self-contained.

- **Pronunciation**: _Stunk_ (a playful blend of "state" and "chunk")

## Features

- 🚀 **Lightweight** — 3.32kB gzipped, zero dependencies
- ⚛️ **Atomic** — break state into independent chunks
- 🔄 **Reactive** — fine-grained updates, only affected components re-render
- 🧮 **Auto-tracking computed** — no dependency arrays, just call `.get()`
- 🌐 **Async & Query layer** — loading, error, caching, deduplication, pagination built in
- 🔁 **Mutations** — reactive POST/PUT/DELETE with automatic cache invalidation
- 📦 **Batch updates** — group multiple updates into one render
- 🔌 **Middleware** — logging, persistence, validation — plug anything in
- ⏱️ **Time travel** — undo/redo state changes
- 🔍 **TypeScript first** — full type inference, no annotations needed

## Installation

```bash
npm install stunk
# or
yarn add stunk
# or
pnpm add stunk
```

📖 [Read the docs](https://stunk.dev)

---

## Core State

```ts
import { chunk } from "stunk";

const count = chunk(0);

count.get();                    // 0
count.set(10);                  // set directly
count.set((prev) => prev + 1);  // updater function
count.peek();                   // read without tracking dependencies
count.reset();                  // back to 0
count.destroy();                // clear all subscribers
```

---

## Computed — auto dependency tracking

No dependency arrays. Any chunk whose `.get()` is called inside the function is tracked automatically:

```ts
import { chunk, computed } from "stunk";

const price    = chunk(100);
const quantity = chunk(3);

const total = computed(() => price.get() * quantity.get());

total.get(); // 300

price.set(200);
total.get(); // 600 — recomputed automatically
```

Use `.peek()` to read without tracking:

```ts
const taxRate = chunk(0.1);
const subtotal = computed(() => price.get() * (1 + taxRate.peek()));
// only recomputes when price changes
```

---

## Async & Query

```ts
import { asyncChunk } from "stunk/query";

const userChunk = asyncChunk(
  async ({ id }: { id: number }) => fetchUser(id),
  {
    key: "user",              // deduplicates concurrent requests
    keepPreviousData: true,   // no UI flicker on param changes
    staleTime: 30_000,
    onError: (err) => toast.error(err.message),
  }
);

userChunk.setParams({ id: 1 });
// { loading: true, data: null, error: null }
// { loading: false, data: { id: 1, name: "..." }, error: null }
```

---

## Mutations

Reactive POST/PUT/DELETE — one function, always safe to await or fire and forget:

```ts
import { mutation } from "stunk/query";

const createPost = mutation(
  async (data: NewPost) => fetchAPI("/posts", { method: "POST", body: data }),
  {
    invalidates: [postsChunk],                  // auto-reloads on success
    onSuccess: () => toast.success("Created!"),
    onError:   (err) => toast.error(err.message),
  }
);

// Fire and forget — safe
createPost.mutate({ title: "Hello" });

// Await for local control — no try/catch needed
const { data, error } = await createPost.mutate({ title: "Hello" });
if (!error) router.push("/posts");
```

---

## Global Query Config

Set defaults once for all async chunks and mutations:

```ts
import { configureQuery } from "stunk/query";

configureQuery({
  query: {
    staleTime: 30_000,
    retryCount: 3,
    onError: (err) => toast.error(err.message),
  },
  mutation: {
    onError: (err) => toast.error(err.message),
  },
});
```

---

## Middleware

```ts
import { chunk } from "stunk";
import { logger, nonNegativeValidator } from "stunk/middleware";

const score = chunk(0, {
  middleware: [logger(), nonNegativeValidator]
});

score.set(10); // logs: "Setting value: 10"
score.set(-1); // throws: "Value must be non-negative!"
```

---

## History (undo/redo)

```ts
import { chunk } from "stunk";
import { history } from "stunk/middleware";

const count   = chunk(0);
const tracked = history(count);

tracked.set(1);
tracked.set(2);
tracked.undo();   // 1
tracked.redo();   // 2
tracked.reset();  // 0 — clears history too
```

---

## Persist

```ts
import { chunk } from "stunk";
import { persist } from "stunk/middleware";

const theme = chunk<"light" | "dark">("light");
const saved = persist(theme, { key: "theme" });

saved.set("dark");       // saved to localStorage
saved.clearStorage();    // remove from localStorage
```

---

## React

```tsx
import { chunk, computed } from "stunk";
import { useChunk, useChunkValue, useAsyncChunk, useMutation } from "stunk/react";

const counter = chunk(0);
const double  = computed(() => counter.get() * 2);

function Counter() {
  const [count, setCount] = useChunk(counter);
  const doubled           = useChunkValue(double);

  return (
    <div>
      <p>Count: {count} — Doubled: {doubled}</p>
      <button onClick={() => setCount((n) => n + 1)}>+</button>
    </div>
  );
}

// Async
function PostList() {
  const { data, loading, error } = useAsyncChunk(postsChunk);
  if (loading) return <p>Loading...</p>;
  return <ul>{data?.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}

// Mutation
function CreatePostForm() {
  const { mutate, loading, error } = useMutation(createPost);

  const handleSubmit = async (data: NewPost) => {
    const { error } = await mutate(data);
    if (!error) router.push("/posts");
  };
}
```

---

## Package exports

| Import             | Contents                                                        |
| ------------------ | --------------------------------------------------------------- |
| `stunk`            | `chunk`, `computed`, `select`, `batch`, `isChunk`, and more     |
| `stunk/react`      | `useChunk`, `useChunkValue`, `useAsyncChunk`, `useInfiniteAsyncChunk`, `useMutation` |
| `stunk/query`      | `asyncChunk`, `infiniteAsyncChunk`, `combineAsyncChunks`, `mutation`, `configureQuery` |
| `stunk/middleware` | `history`, `persist`, `logger`, `nonNegativeValidator`          |

---

## Contributing

Contributions are welcome — open a [pull request](https://github.com/I-am-abdulazeez/stunk/pulls) or [issue](https://github.com/I-am-abdulazeez/stunk/issues).

## License

MIT
