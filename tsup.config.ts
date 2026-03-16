import { defineConfig } from 'tsup'

export default defineConfig([
  // Main bundle — core, utilities, types
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
    env: {
      NODE_ENV: 'production',
    },
    define: {
      __DEV__: 'false',
    },
  },

  // Subpath entries — middleware, query, react, vue
  {
    entry: {
      'middleware/index': 'src/middleware/index.ts',
      'use-react/index': 'src/use-react/index.ts',
      'query/index': 'src/query/index.ts',
      // 'use-vue/index': 'src/use-vue/index.ts',
    },
    format: ['esm'],
    dts: true,
    minify: true,
    sourcemap: false,
    outDir: 'dist',
    treeshake: true,
    target: 'es2020',
    external: ['react', 'vue'],
    define: {
      __DEV__: 'true',
    },
  }
])
