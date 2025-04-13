# Stunk

Stunk is a lightweight, framework-agnostic state management library built on atomic state principles. It simplifies state management by breaking state into manageable "chunks", ensuring efficient updates and reactivity.

- **Pronunciation**: _Stunk_ (A playful blend of "state" and "chunk")

**Stunk** is like dividing your jar into many smaller containers, each holding a single piece of state. These smaller containers are called **chunks**. Each **chunk** can be updated and accessed easily, and any part of your app can subscribe to changes in a chunk so it gets updated automatically.

## Features

- 🚀 **Lightweight and Fast**: No dependencies, minimal overhead
- 🔄 **Reactive**: Automatic updates when state changes
- 📦 **Batch Updates**: Group multiple state updates together
- 🎯 **Atomic State Management**: Break down state into manageable chunks
- 🎭 **State Selection**: Select and derive specific parts of the state
- 🔄 **Async Support**: Handle async state with built-in loading and error states
- 🔌 **Middleware Support**: Extend functionality with custom middleware
- ⏱️ **Time Travel**: Undo/redo state changes
- 🔍 **Type-Safe**: Written in TypeScript with full type inference

## Installation

```bash
npm install stunk
# or
yarn add stunk
# or
pnpm install stunk
```

Read Docs:

[Stunk](https://stunk.vercel.app/)

## Creating a Chunk

```typescript
import { chunk } from "stunk";

// Create a chunk holding a number
const count = chunk(0);

// Create a chunk holding a string
const name = chunk("Stunky, chunky");
```

👉 [See full explanation in docs](https://stunk.vercel.app/chunk.html)

## Interacting with a Chunk

```typescript
// Get value
console.log(count.get()); // 0

// Set a new value
count.set(10);

// Update based on the previous value
count.set((prev) => prev + 1);

// Reset to the initial value
count.reset();

// Destroy the chunk and all its subscribers.
count.destroy();
```

👉 [See full explanation in docs](https://stunk.vercel.app/chunk.html)

## React via useChunk

The `useChunk` hook, enables components to reactively read and update state from a Chunk. The counter example below depicts

```typescript
import { chunk } from "stunk";
import { useChunk } from "stunk/react";

const count = chunk(0);

const Counter = () => {
  const [value, set, reset] = useChunk(count);

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => set((prev) => prev + 1)}>Increment</button>
      <button onClick={() => reset()}>Reset</button>
    </div>
  );
};
```

👉 [See full explanation in docs](https://stunk.vercel.app/useChunk.html)

## React via useDerive

Hook that lets you create a read-only derived state from a Chunk. It keeps the derived value reactive, automatically updating whenever the source Chunk changes.

```typescript
import { chunk } from "stunk";
import { useDerive } from "stunk/react";

const count = chunk(0);

const DoubledCount = () => {
  const double = useDerive(count, (value) => value * 2);

  return <p>Double: {double}</p>;
};
```

👉 [See full explanation in docs](https://stunk.vercel.app/useDerive.html)

## React via useComputed

Hook that derives a computed value from one or more Chunks. It automatically re-evaluates whenever any of its dependencies change, ensuring efficient and reactive updates.

```typescript
import { chunk } from "stunk";
import { useComputed } from "stunk/react";

const count = chunk(2);
const multiplier = chunk(3);

const ComputedExample = () => {
  const product = useComputed([count, multiplier], (c, m) => c * m);

  return <p>Product: {product}</p>;
};
```

👉 [See full explanation in docs](https://stunk.vercel.app/useComputed.html)

## React via useAsyncChunk

Hook that manages that manages asynchronous state. It offers built-in reactivity, handling loading, error, and data states, ensuring the UI stays in sync with asynchronous operations.

```typescript
import { asyncChunk } from "stunk";
import { useAsyncChunk } from "stunk/react";

const fetchUser = asyncChunk(async () => {
  const res = await fetch("https://jsonplaceholder.typicode.com/users/1");
  return res.json();
});

const UserProfile = () => {
  const { data, loading, error, reload } = useAsyncChunk(fetchUser);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>{data.name}</h2>
      <p>{data.email}</p>
      <button onClick={reload}>Reload</button>
    </div>
  );
};
```

👉 [See full explanation in docs](https://stunk.vercel.app/useAysncChunk.html)

## React via useChunkValue

Hook that subscribes to a Chunk and returns its current value. It is useful for read-only components that don’t need to modify the state.

```typescript
import { chunk } from "stunk";
import { useChunkValue } from "stunk/react";

const count = chunk(0);

const CounterDisplay = () => {
  const value = useChunkValue(count);

  return <p>Count: {value}</p>;
};
```

👉 [See full explanation in docs](https://stunk.vercel.app/read-only-values.html)

Live Examples:

👉 [Visit](https://stunk-examples.vercel.app/)

Coding Examples:

👉 [Visit](https://stunk.vercel.app/examples.html)

Further Examples:

👉 [Visit](https://github.com/I-am-abdulazeez/stunk-examples/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

[Pull Request](https://github.com/I-am-abdulazeez/stunk/pulls)

## License

This is licence under MIT
