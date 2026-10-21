import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata, which Nest DI needs and esbuild does not.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'integration',
    include: ['src/test/integration/**/*.integration.spec.ts'],
    globalSetup: ['src/test/integration/global-setup.ts'],
    testTimeout: 60_000, // containers take time
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
    pool: 'forks', // testcontainers requires separate processes
    fileParallelism: false, // shared containers, specs reset state themselves
    reporters: ['verbose'],
  },
});
