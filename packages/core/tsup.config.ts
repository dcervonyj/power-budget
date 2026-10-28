import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    'domain/index': 'src/domain/index.ts',
    'logic/index': 'src/logic/index.ts',
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
