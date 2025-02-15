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

## Batch Updates

Batch Update group multiple **state changes** together and notify **subscribers** only once at the end of the `batch`. This is particularly useful for **optimizing performance** when you need to **update multiple** chunks at the same time.

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

## Computed

Computed Chunks in Stunk allow you to create state derived from other chunks in a reactive way. Unlike derived chunks, computed chunks can depend on multiple sources, and they automatically recalculate when any of the source chunks change.

- Multiple Dependencies: Can depend on multiple chunks.
- Memoization: Only recalculates when dependencies change.
- Type-Safe: Fully typed in TypeScript for safe data handling.
- Reactive: Automatically updates subscribers when any dependency changes.

```typescript
import { chunk, computed } from "stunk";

const firstNameChunk = chunk("John");
const lastNameChunk = chunk("Doe");
const ageChunk = chunk(30);
// Create a computed chunk that depends on multiple sources

const fullInfoChunk = computed(
  [firstNameChunk, lastNameChunk, ageChunk],
  (firstName, lastName, age) => ({
    fullName: `${firstName} ${lastName}`,
    isAdult: age >= 18,
  })
);

firstNameChunk.set("Ola");
ageChunk.set(10);

console.log(fullInfoChunk.get());
// ✅ { fullName: "Ola Doe", isAdult: true }
```

`computed` chunks are ideal for scenarios where state depends on multiple sources or needs complex calculations. They ensure your application remains performant and maintainable.

## Advanced Examples

Form Validation Example

```typescript
// With derive - single field validation
const emailChunk = chunk("user@example.com");
const isValidEmailChunk = emailChunk.derive((email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
);

// With computed - full form validation
const usernameChunk = chunk("john");
const emailChunk = chunk("user@example.com");
const passwordChunk = chunk("pass123");
const confirmPasswordChunk = chunk("pass123");

const formValidationChunk = computed(
  [usernameChunk, emailChunk, passwordChunk, confirmPasswordChunk],
  (username, email, password, confirmPass) => ({
    isUsernameValid: username.length >= 3,
    isEmailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    isPasswordValid: password.length >= 6,
    doPasswordsMatch: password === confirmPass,
    isFormValid:
      username.length >= 3 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      password.length >= 6 &&
      password === confirmPass,
  })
);

console.log(formValidationChunk.get());
```

Data Filtering Example

```typescript
// With derive - simple filter
const postsChunk = chunk([
  { id: 1, title: "Post 1", published: true },
  { id: 2, title: "Post 2", published: false },
]);

const publishedPostsChunk = postsChunk.derive((posts) =>
  posts.filter((post) => post.published)
);

// With computed - complex filtering with multiple conditions
const postsChunk = chunk([
  { id: 1, title: "Post 1", category: "tech", date: "2024-01-01" },
]);
const categoryFilterChunk = chunk("tech");
const dateRangeChunk = chunk({ start: "2024-01-01", end: "2024-02-01" });
const searchTermChunk = chunk("");

const filteredPostsChunk = computed(
  [postsChunk, categoryFilterChunk, dateRangeChunk, searchTermChunk],
  (posts, category, dateRange, searchTerm) =>
    posts.filter(
      (post) =>
        (!category || post.category === category) &&
        (!dateRange ||
          (post.date >= dateRange.start && post.date <= dateRange.end)) &&
        (!searchTerm ||
          post.title.toLowerCase().includes(searchTerm.toLowerCase()))
    )
);
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

The `withHistory` middleware extends a chunk to support undo and redo functionality. This allows you to navigate back and forth between previous states, making it useful for implementing features like undo/redo, form history, and state time travel.

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

## State Persistence (Middleware)

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

Using Different Storage

```typescript
// Use sessionStorage instead of localStorage
const sessionStorageChunk = withPersistence(baseChunk, {
  key: "counter",
  storage: sessionStorage,
});
```

Custom Serialization

```typescript
// Add custom serialization/deserialization
const encryptedChunk = withPersistence(baseChunk, {
  key: "encrypted-data",
  serialize: (value) => encrypt(JSON.stringify(value)),
  deserialize: (value) => JSON.parse(decrypt(value)),
});
```

## Once

`Once` utility is a function that ensures a given piece of code or a function is executed only once, no matter how many times it's called. It's typically used to optimize performance by preventing redundant calculations or event handlers from running multiple times.

How It Works:

- It wraps a function and tracks whether it has been called.
- On the first call, it executes the function and saves the result.
- On subsequent calls, it simply returns the saved result without executing the function again.

```typescript
const numbersChunk = chunk([1, 2, 3, 4, 5]);

const expensiveCalculation = once(() => {
  console.log("Expensive calculation running...");
  return numbersChunk.get().reduce((sum, num) => sum + num, 0);
});

// Derived chunk using the once utility
const totalChunk = numbersChunk.derive(() => expensiveCalculation());

totalChunk.subscribe((total) => {
  console.log("Total:", total);
});

// Even if numbersChunk updates, the expensive calculation runs only once
numbersChunk.set([10, 20, 30, 40, 50]);
```

## Async State

Async Chunks in Stunk are designed to manage asynchronous state seamlessly. They handle loading, error, and data states automatically, making it easier to work with APIs and other asynchronous operations.

Key Features

- Built-in Loading and Error States: Automatically manages loading, error, and data properties.

- Type-Safe: Fully typed in TypeScript, ensuring safe data handling.

- Optimistic Updates: Update state optimistically and revert if needed.

```typescript
import { asyncChunk } from "stunk";

type User = {
  id: number;
  name: string;
  email: string;
};

// Create an Async Chunk
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

// Subscribe to state changes
user.subscribe(({ loading, error, data }) => {
  if (loading) console.log("Loading...");
  if (error) console.log("Error:", error);
  if (data) console.log("User:", data);
});
```

**Reloading Data**

```typescript
// Reload data
await user.reload();
```

**Optimistic Updates**

```typescript

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

## Combine Async Chunk

`combineAsyncChunks` utility is used for managing multiple related async chunks.

- Maintains reactivity through the entire chain
- Preserves previous data during reloading
- Proper error propagation

```typescript
// Basic fetch
const userChunk = asyncChunk(async () => {
  const response = await fetch("/api/user");
  return response.json();
});

// With options
const postsChunk = asyncChunk(
  async () => {
    const response = await fetch("/api/posts");
    return response.json();
  },
  {
    initialData: [],
    retryCount: 3,
    retryDelay: 2000,
    onError: (error) => console.error("Failed to fetch posts:", error),
  }
);

// Combining chunks
const profileChunk = combineAsyncChunks({
  user: userChunk,
  posts: postsChunk,
});

// Reactive updates
profileChunk.subscribe(({ loading, error, data }) => {
  if (loading) {
    showLoadingSpinner();
  } else if (error) {
    showError(error);
  } else {
    updateUI(data);
  }
});
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
