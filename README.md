# Stunk

**Stunk** is a **framework-agnostic** state management library that helps you manage your application's state in a clean and simple way. It uses a technique called **Atomic State**, breaking down state into smaller **chunks** that are easy to update, subscribe to, and manage.

---

## Pronunciation and Meaning

- **Pronunciation**: _Stunk_ (A playful blend of "state" and "chunk")
- **Meaning**: "Stunk" represents the combination of state management with chunk-based atomic units. The term captures the essence of atomic state management while using "chunk" to refer to these discrete units of state.

## What is Stunk?

Think of your application's state as a big jar of data. In traditional state management, you keep everything in one big jar, and every time you want to change something, you have to dig through the whole jar.

**Stunk** is like dividing your jar into many smaller containers, each holding a single piece of state. These smaller containers are called **chunks**. Each **chunk** can be updated and accessed easily, and any part of your app can subscribe to changes in a chunk so it gets updated automatically.

---

## Installation

You can install **Stunk** from NPM:

```bash
npm install stunk
```

## Features

### 1. **Chunks**

A **chunk** is a small container of state. It holds a value, and you can do three things with it:

- **Get** the current value of the chunk
- **Set** a new value for the chunk
- **Subscribe** to the chunk to get notified whenever the value changes

### Example:

```ts
import { chunk } from "stunk";

const count = chunk(0);

console.log(count.get()); // 0

count.set(5);

console.log(count.get()); // 5
```

### 2. **Subscription**

You can **subscribe** to a **chunk**. This means you get notified whenever the value inside the chunk changes. This is super useful for updating your app automatically when **state** changes.

### Example

```ts
const count = chunk(0);
const callback = (newValue: number) => console.log("Updated value:", newValue);

count.subscribe(callback);

count.set(10); // Will log: "Updated value: 10"
```

### 3. **Unsubscribing**

You can **unsubscribe** from a **chunk**, which means you stop getting notifications when the **value changes**. You can do this by calling the function that’s returned when you **subscribe..** Well, would you wanna do that? 😂

### Example

```ts
const count = chunk(0);
const callback = (newValue: number) => console.log("Updated value:", newValue);

const unsubscribe = count.subscribe(callback);

count.set(10); // Will log: "Updated value: 10"

unsubscribe(); // Unsubscribe

count.set(20); // Nothing will happen now, because you unsubscribed
```
