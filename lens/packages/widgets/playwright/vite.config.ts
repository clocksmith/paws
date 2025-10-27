import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PlaywrightWidget',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@mwp/core'],
      output: {
        globals: {
          '@mwp/core': 'MCPCore',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@mwp/widget-playwright': resolve(__dirname, 'src'),
    },
  },
});
