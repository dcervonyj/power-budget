import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'contract/index': 'src/contract/index.ts',
    'infrastructure/index': 'src/infrastructure/index.ts',
    'auth/index': 'src/auth/index.ts',
    'bank/index': 'src/bank/index.ts',
    'transactions/index': 'src/transactions/index.ts',
    'plans/index': 'src/plans/index.ts',
    'categories/index': 'src/categories/index.ts',
    'currency/index': 'src/currency/index.ts',
    'notifications/index': 'src/notifications/index.ts',
    'dashboard/index': 'src/dashboard/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
});
