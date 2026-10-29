import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    'contract/index': 'src/contract/index.ts',
    'infrastructure/index': 'src/infrastructure/index.ts',
    'plans/index': 'src/plans/index.ts',
    'categories/index': 'src/categories/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  // Watch mode must not wipe dist: web/backend read it while it rebuilds.
  clean: !options.watch,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
}));
