import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', '__tests__/**/*.spec.ts'],
    exclude: ['src/test/integration/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Gate applies to the application layer; the report below is for visibility.
      include: ['src/application/**'],
      // Barrel re-exports carry no logic; vitest 3's v8 remapping counts them as uncovered lines.
      exclude: ['src/application/**/index.ts'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
