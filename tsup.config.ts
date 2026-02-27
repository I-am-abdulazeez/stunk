import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: true,
    sourcemap: false,
    outDir: 'dist',
    treeshake: true,
    splitting: false,
    target: 'es2020',
  },
  // Framework-specific entries
  {
    entry: {
      'middleware/index': 'src/middleware/index.ts',
      'use-react/index': 'src/use-react/index.ts',
      'use-vue/index': 'src/use-vue/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    minify: true,
    sourcemap: false,
    outDir: 'dist',
    treeshake: true,
    target: 'es2020',
    external: ['react', 'vue'], // Don't bundle peer dependencies
  }
])
