import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SupabaseWidget',
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
      '@mwp/widget-supabase': resolve(__dirname, 'src'),
    },
  },
});
