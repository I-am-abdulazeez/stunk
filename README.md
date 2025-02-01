# Stunk

A lightweight, framework-agnostic state management library using atomic state principles. Stunk breaks down state into manageable "chunks" for easy updates and subscriptions.

## Pronunciation and Meaning

- **Pronunciation**: _Stunk_ (A playful blend of "state" and "chunk")
- **Meaning**: "Stunk" represents the combination of state management with chunk-based atomic units. The term captures the essence of atomic state management while using "chunk" to refer to these discrete units of state.

## What is Stunk?

Think of your application's state as a big jar of data. In traditional state management, you keep everything in one big jar, and every time you want to change something, you have to dig through the whole jar.

**Stunk** is like dividing your jar into many smaller containers, each holding a single piece of state. These smaller containers are called **chunks**. Each **chunk** can be updated and accessed easily, and any part of your app can subscribe to changes in a chunk so it gets updated automatically.

## Features

<!-- - 🎯 Framework agnostic -->

- 🔄 Reactive updates with efficient subscription system
- 🎯 Granular state selection
- ⏳ Built-in undo/redo/getHistory/clearHistory
- 🔄 Batch updates for performance and nested batch updates
- 🛠️ Extensible middleware
- 🔍 Full TypeScript support

## Installation

```bash
npm install stunk
```

## Quick Start

```typescript
import { chunk, select, batch } from "stunk";

// Create a state chunk
const counter = chunk(0);
const userChunk = chunk({ name: "Olamide", age: 26 });

// Select specific state - Selector
const nameSelector = select(userChunk, (user) => user.name);

// Subscribe to changes
nameSelector.subscribe((name) => console.log("Name:", name));
counter.subscribe((count) => console.log("Counter", counter));

// Batch updates
batch(() => {
  userChunk.set({ name: "Olalekan", age: 27 }); // Doesn't log yet
  counter.set(5); // Doesn't log yet
}); // All logs happen here at once
```

## Core Concepts

### Chunks

Basic unit of state with get/set/subscribe functionality:

```typescript
const counter = chunk(0);
counter.subscribe((value) => console.log(value));
counter.set(5);
```

## Unsubscribing

You can **unsubscribe** from a **chunk**, which means you stop getting notifications when the **value changes**. You can do this by calling the function that's returned when you **subscribe..**

### Usage

```ts
const count = chunk(0);
const callback = (newValue: number) => console.log("Updated value:", newValue);

const unsubscribe = count.subscribe(callback);

count.set(10); // Will log: "Updated value: 10"

unsubscribe(); // Unsubscribe

count.set(20); // Nothing will happen now, because you unsubscribed
```

### Deriving New Chunks

With Stunk, you can create **derived chunks**. This means you can create a new **chunk** based on the value of another **chunk**. When the original **chunk** changes, the **derived chunk** will automatically update.

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

### Batch Updates

Group multiple updates:

```typescript
batch(() => {
  chunk1.set(newValue1);
  chunk2.set(newValue2);
}); // Single notification

// Nested batches are also supported
batch(() => {
  chunk1.set("Tunde");
  batch(() => {
    chunk1.set(26);
  });
});
```

### Selectors

Efficiently access and react to specific state parts:

```typescript
// With selector - more specific, read-only
const userChunk = chunk({ name: "Olamide", score: 100 });
const scoreSelector = select(userChunk, (u) => u.score);
// scoreSelector.set(200); // This would throw an error
```

## Middleware

Middleware allows you to customize how values are set in a **chunk**. For example, you can add **logging**, **validation**, or any custom behavior when a chunk's value changes.

```typescript
// You can also create yours and pass it []

// Use middleware for logging and validation
const age = chunk(25, [logger, nonNegativeValidator]);

age.set(30); // Logs: "Setting value: 30"
age.set(-5); // Throws an error: "Value must be non-negative!"
```

### History (Undo/Redo) - Time Travel

```typescript
const counter = withHistory(chunk(0));

counter.set(10);
counter.set(20);

console.log(counter.get()); // 20

counter.undo(); // Go back one step
console.log(counter.get()); // 10

counter.redo(); // Go forward one step
console.log(counter.get()); // 20
```

**Example: Limiting History Size (Optional)**
You can specify a max history size to prevent excessive memory usage.

```ts
const counter = withHistory(chunk(0), { maxHistory: 5 }); // Only keeps the last 5 changes -- default is 100.
```

This prevents the history from growing indefinitely and ensures efficient memory usage.

## API Reference

### `chunk<T>(initialValue: T, middleware?: Middleware<T>[])`

Creates a new state chunk.

```typescript
interface Chunk<T> {
  get(): T;
  set(value: T): void;
  subscribe(callback: (value: T) => void): () => void;
  derive<D>(fn: (value: T) => D): Chunk<D>;
  destroy(): void;
}
```

### `select<T, S>(sourceChunk: Chunk<T>, selector: (value: T) => S)`

Creates an optimized selector.

```typescript
// Returns a read-only chunk that updates only when selected value changes
const selector = select(userChunk, (user) => user.name);
```

### `batch(callback: () => void)`

Batches multiple updates.

```typescript
batch(() => {
  // Multiple updates here
});

batch(() => {
  // Multiple updates here
  batch(() => {
    // Nested upddates here
  });
});
```

### `withHistory<T>(chunk: Chunk<T>, options?: { maxHistory?: number })`

Adds undo/redo capabilities.

```typescript
interface ChunkWithHistory<T> extends Chunk<T> {
  undo(): void; // Reverts to the previous state (if available).
  redo(): void; // Moves forward to the next state (if available).
  canUndo(): boolean; // Returns `true` if there are past states available.
  canRedo(): boolean; // Returns `true` if there are future states available.
  getHistory(): T[]; // Returns an `array` of all past states.
  clearHistory(): void; // Clears all stored history and keeps only the current state.
}
```

### `Middleware<T>`

Custom state processing:

```typescript
type Middleware<T> = (value: T, next: (newValue: T) => void) => void;
```

- value: The value that is about to be set to the chunk.
- next(value): A function you must call with the processed (or unaltered) value to continue the chain of middleware and eventually update the chunk's state.

## License

MIT
