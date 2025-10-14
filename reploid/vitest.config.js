import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['upgrades/**/*.js', 'server/**/*.js'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.js',
        '**/dist/**'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
