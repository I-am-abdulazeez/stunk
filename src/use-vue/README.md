# Stunk `use-vue` Usage Guide

This guide demonstrates how to use and extend all composables from the Stunk Vue integration. Each example is ready to copy into your Vue app.

---

## 1. `useChunk`

```ts
import { chunk } from '../core/core'
import { useChunk } from './composables/useChunk'

const counterChunk = chunk(0)
const [counter, setCounter, resetCounter] = useChunk(counterChunk)

setCounter(5) // Set value
resetCounter() // Reset to initial value
```

---

## 2. `useChunkForm`

```ts
import { chunk } from '../core/core'
import { useChunkForm } from './composables/useChunkForm'

const formChunk = chunk({ name: '', email: '' })
const form = useChunkForm(formChunk, {
  name: (v: string) => v.length < 2 ? 'Name too short' : null,
  email: (v: string) => !v.includes('@') ? 'Invalid email' : null
})

form.setField('name', 'Alice')
form.reset()
```

---

## 3. `useBatch`

```ts
import { useBatch } from './composables/useBatch'

const { batch } = useBatch()
batch(() => {
  // Multiple chunk updates here
})
```

---

## 4. `useAsyncChunk`

```ts
import { AsyncChunk } from '../core/asyncChunk'
import { useAsyncChunk } from './composables/useAsyncChunk'

const asyncChunk = new AsyncChunk(async () => fetch('/api/data').then(r => r.json()))
const state = useAsyncChunk(asyncChunk)

state.reload()
```

---

## 5. `useChunkProperty`

```ts
import { chunk } from '../core/core'
import { useChunkProperty } from './composables/useChunkProperty'

const objChunk = chunk({ a: 1, b: 2 })
const { value, set } = useChunkProperty(objChunk, 'a')

set(10)
```

---

## 6. `useChunkValue`

```ts
import { chunk } from '../core/core'
import { useChunkValue } from './composables/useChunkValue'

const counterChunk = chunk(0)
const value = useChunkValue(counterChunk)
```

---

## 7. `useComputed`

```ts
import { chunk } from '../core/core'
import { useComputed } from './composables/useComputed'

const counterChunk = chunk(2)
const doubleCounter = useComputed([counterChunk], (c: number) => c * 2)
```

---

## 8. `useDerive`

```ts
import { chunk } from '../core/core'
import { useDerive } from './composables/useDerive'

const counterChunk = chunk(3)
const isEven = useDerive(counterChunk, (c: number) => c % 2 === 0)
```

---

## Extending Composables

You can wrap or compose these composables for custom logic:

```ts
import { chunk } from '../core/core'
import { useChunk } from './composables/useChunk'

export function useCustomCounter() {
  const counterChunk = chunk(0)
  const [value, set, reset] = useChunk(counterChunk)
  function add(amount: number) {
    set((current: number) => current + amount)
  }
  return { value, add, reset }
}
```

---

## How to Use `use-vue`

1. **Install Stunk and dependencies**
2. **Import the composables you need from `src/use-vue/composables/`**
3. **Create and manage state using the chunk primitives and composables**
4. **Integrate with your Vue components as shown above**

For more advanced usage, see the source code and type definitions in `src/use-vue/types.ts`.
