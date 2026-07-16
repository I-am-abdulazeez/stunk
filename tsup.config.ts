import { defineConfig } from 'tsup'

export default defineConfig({
  // A single entry group so every entry point shares the same code-split
  // chunks — critically core/core.ts, which holds the module-level
  // dependency-tracking state computed()/select()/batch() rely on. Building
  // the main entry separately (as two defineConfig groups previously did)
  // gives it its own inlined copy of core.ts, so a computed() imported from
  // 'stunk' can never track a dependency read inside a chunk created via
  // 'stunk/query' (or vue/react) — they're watching two different
  // activeEffect variables that never see each other.
  entry: {
    index: 'src/index.ts',
    'middleware/index': 'src/middleware/index.ts',
    'use-react/index': 'src/use-react/index.ts',
    'query/index': 'src/query/index.ts',
    'use-vue/index': 'src/use-vue/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: false,
  outDir: 'dist',
  treeshake: true,
  splitting: true,
  target: 'es2020',
  external: ['react', 'vue'],
  define: {
    __DEV__: 'false',
  },
})
