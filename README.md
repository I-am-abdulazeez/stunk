# Stunk

**Stunk** is a **framework-agnostic** state management library that helps you manage your application's state in a clean and simple way. It uses a technique called **Atomic State**, breaking down state into smaller **chunks** that are easy to update, subscribe to, and manage.

---

## Pronunciation and Meaning

- **Pronunciation**: _Stunk_ (A playful blend of "state" and "chunk")
- **Meaning**: "Stunk" represents the combination of state management with chunk-based atomic units. The term captures the essence of atomic state management while using "chunk" to refer to these discrete units of state.

## What is Stunk?

Think of your application's state as a big jar of data. In traditional state management, you keep everything in one big jar, and every time you want to change something, you have to dig through the whole jar.

**Stunk** is like dividing your jar into many smaller containers, each holding a single piece of state. These smaller containers are called **chunks**. Each **chunk** can be updated and accessed easily, and any part of your app can subscribe to changes in a chunk so it gets updated automatically.

### Why Stunk

- lightweight, framework-agnostic state management.
- granular control over state updates and subscriptions.
- modular and composable state architecture.

---

## Installation

You can install **Stunk** from NPM:

```bash
npm install stunk
```

## 1 Features

### 1.0 **Chunks**

A **chunk** is a small container of state. It holds a value, and you can do three things with it:

- **Get** the current value of the chunk
- **Set** a new value for the chunk
- **Subscribe** to the chunk to get notified whenever the value changes

### Usage:

```ts
import { chunk } from "stunk";

const count = chunk(0);

console.log(count.get()); // 0

count.set(5);

console.log(count.get()); // 5
```

### 1.1. **Subscription**

You can **subscribe** to a **chunk**. This means you get notified whenever the value inside the chunk changes. This is super useful for updating your app automatically when **state** changes.

### Usage

```ts
const count = chunk(0);
const callback = (newValue: number) => console.log("Updated value:", newValue);

count.subscribe(callback);

count.set(10); // Will log: "Updated value: 10"
```

### 1.2. **Deriving New Chunks**

With Stunk, you can create **derived chunks**. This means you can create a new **chunk** based on the value of another **chunk**. When the original **chunk** changes, the **derived chunk** will automatically update.

### Usage

```ts
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

### 1.3. **Unsubscribing**

You can **unsubscribe** from a **chunk**, which means you stop getting notifications when the **value changes**. You can do this by calling the function that's returned when you **subscribe..** Well, would you wanna do that? 😂

### Usage

```ts
const count = chunk(0);
const callback = (newValue: number) => console.log("Updated value:", newValue);

const unsubscribe = count.subscribe(callback);

count.set(10); // Will log: "Updated value: 10"

unsubscribe(); // Unsubscribe

count.set(20); // Nothing will happen now, because you unsubscribed
```

### 1.4. **Batch Updates**

Batch updates allow you to group multiple **state changes** together and notify **subscribers** only once at the end of the **batch**. This is particularly useful for **optimizing performance** when you need to **update multiple** chunks at the same time.

### Usage

```ts
import { chunk, batch } from "stunk";

const firstName = chunk("John");
const lastName = chunk("Doe");
const age = chunk(25);

// Subscribe to changes
firstName.subscribe((name) => console.log("First name changed:", name));
lastName.subscribe((name) => console.log("Last name changed:", name));
age.subscribe((age) => console.log("Age changed:", age));

// Without batch - triggers three separate updates
firstName.set("Jane"); // Logs immediately
lastName.set("Smith"); // Logs immediately
age.set(26); // Logs immediately

// With batch - triggers only one update per chunk at the end
batch(() => {
  firstName.set("Jane"); // Doesn't log yet
  lastName.set("Smith"); // Doesn't log yet
  age.set(26); // Doesn't log yet
}); // All logs happen here at once

// Nested batches are also supported
batch(() => {
  firstName.set("Jane");
  batch(() => {
    lastName.set("Smith");
    age.set(26);
  });
});
```

Looks intresting right? There's more!

Batching is particularly useful when:

- Updating multiple related pieces of state at once
- Performing form updates
- Handling complex state transitions
- Optimizing performance in data-heavy applications

The batch function ensures that:

- All updates within the batch are processed together
- Subscribers are notified only once with the final value
- Nested batches are handled correctly
- Updates are processed even if an error occurs (using try/finally)

### 1.5. **Middleware**

Middleware allows you to customize how values are set in a **chunk**. For example, you can add **logging**, **validation**, or any custom behavior when a chunk's value changes.

A middleware is a function with the following structure:

```ts
export type Middleware<T> = (value: T, next: (newValue: T) => void) => void;
```

- value: The value that is about to be set to the chunk.
- next(value): A function you must call with the processed (or unaltered) value to continue the chain of middleware and eventually update the chunk's state.

### Usage

```ts
import { chunk } from "stunk";
import { logger } from "stunk/middleware"; // native to stunk
import { nonNegativeValidator } from "stunk/middleware"; // native to stunk
// You can also create yours and pass it []

// Use middleware for logging and validation
const age = chunk(25, [logger, nonNegativeValidator]);

age.set(30); // Logs: "Setting value: 30"
age.set(-5); // Throws an error: "Value must be non-negative!"
```

## 2. **Atomic State Technique**

The **Atomic State** technique is all about breaking down your state into small, manageable chunks. This allows you to:

- Keep state changes focused and efficient
- Update only the parts of your app that need to change
- Easily manage and subscribe to state changes
