import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./setup.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
