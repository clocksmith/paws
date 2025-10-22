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
      '@mcp-wp/widget-supabase': resolve(__dirname, 'src'),
    },
  },
});
