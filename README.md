# Stunk

A lightweight, reactive state management library for TypeScript/JavaScript applications. Stunk combines atomic state management with powerful features like middleware, time travel, and async state handling.

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

## Basic Usage

A **chunk** is a small container of state. It holds a value, and you can do some stuffs with it:

```typescript
import { chunk } from "stunk";

// Create a simple counter
const counterChunk = chunk(0);

// Subscribe to changes
counterChunk.subscribe((value) => {
  console.log("Counter changed:", value);
});

// Update the value
counterChunk.set(1);

// Get current value
const value = counterChunk.get(); // 1

// Reset to initial value
counterChunk.reset();
```

## Deriving New Chunks

With **Stunk**, you can create **derived chunks**. This means you can create a new **chunk** based on the value of another **chunk**.
When the original **chunk** changes, the **derived chunk** will automatically update.

```typescript
const count = chunk(5);

// Create a derived chunk that doubles the count
const doubleCount = count.derive((value) => value * 2);

count.subscribe((newValue) => console.log("Count:", newValue));
doubleCount.subscribe((newValue) => console.log("Double count:", newValue));

count.set(10);
// Will log:
// "Count: 10"
// "Double count: 20"
```

## Batch Updates

Batch Update group multiple **state changes** together and notify **subscribers** only once at the end of the **batch**. This is particularly useful for **optimizing performance** when you need to **update multiple** chunks at the same time.

```typescript
import { chunk, batch } from "stunk";

const nameChunk = chunk("Olamide");
const ageChunk = chunk(30);

batch(() => {
  nameChunk.set("AbdulAzeez");
  ageChunk.set(31);
}); // Only one notification will be sent to subscribers

// Nested batches are also supported
batch(() => {
  firstName.set("Olanrewaju");
  batch(() => {
    age.set(29);
  });
}); // Only one notification will be sent to subscribers
```

## State Selection

Efficiently access and react to specific state parts:

```typescript
import { chunk, select } from "stunk";

const userChunk = chunk({
  name: "Olamide",
  age: 30,
  email: "olamide@example.com",
});

// Select specific properties -readonly
const nameChunk = select(userChunk, (state) => state.name);
const ageChunk = select(userChunk, (state) => state.age);

nameChunk.subscribe((name) => console.log("Name changed:", name));
// will only re-render if the selected part change.

nameChunk.set("Olamide"); // ❌ this will throw an error, because it is a readonly.
```

## Middleware

Middleware allows you to customize how values are set in a **chunk**. For example, you can add **logging**, **validation**, or any custom behavior when a chunk's value changes.

```typescript
import { chunk } from "stunk";
import { logger, nonNegativeValidator } from "stunk/middleware";

// You can also create yours and pass it chunk as the second param

// Use middleware for logging and validation
const age = chunk(25, [logger, nonNegativeValidator]);

age.set(30); // Logs: "Setting value: 30"
age.set(-5); // ❌ Throws an error: "Value must be non-negative!"
```

## Time Travel (Middleware)

```typescript
import { chunk } from "stunk";
import { withHistory } from "stunk/midddleware";

const counterChunk = withHistory(chunk(0));

counterChunk.set(1);
counterChunk.set(2);

counterChunk.undo(); // Goes back to 1
counterChunk.undo(); // Goes back to 0

counterChunk.redo(); // Goes forward to 1

counterChunk.canUndo(); // Returns `true` if there is a previous state to revert to..
counterChunk.canRedo(); // Returns `true` if there is a next state to move to.

counterChunk.getHistory(); // Returns an array of all the values in the history.

counterChunk.clearHistory(); // Clears the history, keeping only the current value.
```

**Example: Limiting History Size (Optional)**
You can specify a max history size to prevent excessive memory usage.

```ts
const counter = withHistory(chunk(0), { maxHistory: 5 });
// Only keeps the last 5 changes -- default is 100.
```

This prevents the history from growing indefinitely and ensures efficient memory usage.

## State Persistence

Stunk provides a persistence middleware to automatically save state changes to storage (localStorage, sessionStorage, etc).

```typescript
import { chunk } from "stunk";
import { withPersistence } from "stunk/middleware";

const counterChunk = withPersistence(chunk({ count: 0 }), {
  key: "counter-state",
});

// State automatically persists to localStorage
counterChunk.set({ count: 1 });
```

## Async State

```typescript
import { asyncChunk } from "stunk";

type User = {
  id: number;
  name: string;
  email: string;
};

const user = asyncChunk<User>(async () => {
  const response = await fetch("/api/user");
  return response.json(); // TypeScript expects this to return User;
});

// Now userChunk is typed as AsyncChunk<User>, which means:
user.subscribe((state) => {
  if (state.data) {
    // state.data is typed as User | null
    console.log(state.data.name); // TypeScript knows 'name' exists
    console.log(state.data.age); // ❌ TypeScript Error: Property 'age' does not exist
  }
});

user.subscribe(({ loading, error, data }) => {
  if (loading) console.log("Loading...");
  if (error) console.log("Error:", error);
  if (data) console.log("User:", data);
});

// Reload data
await user.reload();

// Optimistic update
user.mutate((currentData) => ({
  ...currentData,
  name: "Fola",
}));

// The mutate function also enforces the User type
user.mutate(currentUser => ({
  id: currentUser?.id ?? 0,
  name: "Olamide",
  email: "olamide@gmail.com"
  age: 70  // ❌ TypeScript Error: Object literal may only specify known properties
}));
```

## API Reference

### Core

- `chunk<T>(initialValue: T): Chunk<T>`
- `batch(fn: () => void): void`
- `select<T, S>(sourceChunk: Chunk<T>, selector: (state: T) => S): Chunk<S>`
<!-- - `asyncChunk<T>(fetcher: () => Promise<T>, options?): AsyncChunk<T>` -->

### History

- `withHistory<T>(chunk: Chunk<T>, options: { maxHistory?: number }): ChunkWithHistory<T>`

### Persistance

- `withPersistence<T>(baseChunk: Chunk<T>,options: PersistOptions<T>): Chunk<T>`

### Types

```typescript
interface Chunk<T> {
  get(): T;
  set(value: T): void;
  subscribe(callback: (value: T) => void): () => void;
  derive<D>(fn: (value: T) => D): Chunk<D>;
  reset(): void;
  destroy(): void;
}
```

```typescript
interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}
```

```typescript
interface AsyncChunk<T> extends Chunk<AsyncState<T>> {
  reload(): Promise<void>;
  mutate(mutator: (currentData: T | null) => T): void;
}
```

```typescript
interface ChunkWithHistory<T> extends Chunk<T> {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistory: () => T[];
  clearHistory: () => void;
}
```

```typescript
interface PersistOptions<T> {
  key: string; // Storage key
  storage?: Storage; // Storage mechanism (default: localStorage)
  serialize?: (value: T) => string; // Custom serializer
  deserialize?: (value: string) => T; // Custom deserializer
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This is licence under MIT
