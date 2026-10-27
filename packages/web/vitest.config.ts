import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Specs run alongside other work on shared machines; the 5 s default flakes under load.
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 4,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts', '__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
