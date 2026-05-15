import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['src/test/integration/**/*.integration.spec.ts'],
    testTimeout: 60_000, // containers take time
    hookTimeout: 90_000,
    teardownTimeout: 30_000,
    pool: 'forks', // testcontainers requires separate processes
    fileParallelism: false, // single process for shared containers
    reporters: ['verbose'],
    coverage: {
      enabled: false, // separate from unit coverage
    },
  },
});
