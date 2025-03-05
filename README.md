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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

[Pull Request](https://github.com/I-am-abdulazeez/stunk/pulls)

## License

This is licence under MIT
