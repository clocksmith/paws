import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SequentialThinkingWidget',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@mcp-wp/core'],
      output: {
        globals: {
          '@mcp-wp/core': 'MCPCore',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@mcp-wp/widget-sequential-thinking': resolve(__dirname, 'src'),
    },
  },
});
