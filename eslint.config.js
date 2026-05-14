// @ts-check
// ESLint v9 flat config — canonical config for the Power Budget monorepo.
// Each package runs `eslint src --max-warnings 0` via `turbo run lint`.
// Per-package overrides should be added as additional config files inside
// the package (e.g. packages/core/eslint.config.js) that import and extend
// this root config.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ─── Global ignores ─────────────────────────────────────────────────────
  // Flat-config replacement for .eslintignore. Applied to all configs below.
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**', '**/drizzle.config.ts'],
  },

  // ─── TypeScript: recommended rules (.ts / .tsx) ──────────────────────────
  // Provides the full @typescript-eslint/recommended rule set plus plugin
  // and parser wiring. Type-aware rules are layered on top below.
  ...tsPlugin.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  // ─── Language options + type-aware rules ────────────────────────────────
  // `project: true` finds the nearest tsconfig.json for each linted file —
  // monorepo-friendly since every package has its own tsconfig.json.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // ── Type-aware rules (require parserOptions.project) ────────────────
      // These catch real bugs that non-type-aware rules miss.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // ── no-restricted-imports scaffold ──────────────────────────────────
      // Base scaffold — framework-specific packages override this with
      // stricter patterns (e.g. packages/core elevates to 'error' and adds
      // react, @nestjs/*, drizzle-orm, etc. to the patterns list).
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            // React-specific imports must not leak into pure packages.
            // (per-package configs strengthen this to 'error' for core)
          ],
        },
      ],

      // ── react-intl placeholder (enabled in I18N-002) ────────────────────
      // 'react-intl/no-literal-string': 'error', // enabled in I18N-002
    },
  },
];
