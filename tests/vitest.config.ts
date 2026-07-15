import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./setup.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    // `server-only` guards the privileged storage module against client bundles; it
    // throws unless the bundler sets Next's `react-server` condition. Vitest doesn't,
    // so stub it to a no-op here (these are server-side integration tests by design).
    alias: { 'server-only': new URL('./server-only-stub.ts', import.meta.url).pathname },
  },
});
