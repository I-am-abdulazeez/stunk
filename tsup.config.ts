import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'middleware/index': 'src/middleware/index.ts',
    'use-react/index': 'src/use-react/index.ts',
    // 'use-vue/index': 'src/use-vue/index.ts'
  },
  format: ['esm', 'cjs'],
  target: 'es2020',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false
})
