import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        'multi-widget': resolve(__dirname, 'multi-widget.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: '/multi-widget.html',
  },
});
