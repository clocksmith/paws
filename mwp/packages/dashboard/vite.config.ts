import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MCPDashboard',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@mcp-wp/core', '@mcp-wp/bridge', '@mcp-wp/eventbus'],
      output: {
        globals: {
          '@mcp-wp/core': 'MCPCore',
          '@mcp-wp/bridge': 'MCPBridge',
          '@mcp-wp/eventbus': 'MCPEventBus',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@mcp-wp/dashboard': resolve(__dirname, 'src'),
    },
  },
});
