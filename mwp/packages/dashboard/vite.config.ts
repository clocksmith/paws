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
      external: ['@mwp/core', '@mwp/bridge', '@mwp/eventbus'],
      output: {
        globals: {
          '@mwp/core': 'MCPCore',
          '@mwp/bridge': 'MCPBridge',
          '@mwp/eventbus': 'MCPEventBus',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@mwp/dashboard': resolve(__dirname, 'src'),
    },
  },
});
