import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Environment
    environment: 'node',

    // Test files
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts', // Re-export files
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Globals
    globals: true,

    // Reporters
    reporters: ['verbose'],

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Watch
    watch: false,

    // Isolation
    isolate: true,

    // Threads
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  resolve: {
    alias: {
      '@mcp-wp/core': path.resolve(__dirname, './src/index.ts'),
      '@mcp-wp/core/types': path.resolve(__dirname, './src/types/index.ts'),
      '@mcp-wp/core/schemas': path.resolve(__dirname, './src/schemas/index.ts'),
      '@mcp-wp/core/utils': path.resolve(__dirname, './src/utils/index.ts'),
    },
  },
});
