// @ts-check
// ESLint v9 flat config — canonical config for the Power Budget monorepo.
// Each package runs `eslint src --max-warnings 0` via `turbo run lint`.
// Per-package overrides should be added as additional config files inside
// the package (e.g. packages/core/eslint.config.js) that import and extend
// this root config.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const formatjsPlugin = require('eslint-plugin-formatjs').default;
const { layerLintBlocks } = require('./eslint.layers.js');

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
  // Integration test files are excluded because they depend on packages not
  // declared in the main tsconfig (e.g. @testcontainers/*) — they are linted
  // without type-aware rules via the block below.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/src/test/integration/**', '**/__tests__/**', '**/vite.config.ts', '**/vitest.config.ts', '**/e2e/**', '**/e2e-web/**', '**/playwright.config.ts'],
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
      // (formatjs/no-literal-string-in-jsx rule is in the dedicated block below)
    },
  },

  // ─── Per-layer import restrictions (CLN-061) ─────────────────────
  // Defined in eslint.layers.js; must come after the scaffold above so it overrides it.
  ...layerLintBlocks,

  // ─── formatjs: no-literal-string in presentation layers ─────────────────
  // Ensures all user-visible strings in presentation/ go through react-intl.
  // Scoped to presentation/ only — infra and application layers may use literals.
  {
    files: ['packages/*/src/presentation/**/*.{ts,tsx}'],
    ignores: ['packages/*/src/presentation/**/__tests__/**'],
    plugins: { formatjs: formatjsPlugin },
    rules: {
      'formatjs/no-literal-string-in-jsx': 'error',
    },
  },

  // ─── Mobile screens: no hand-typed HTTP responses ──────────────────────
  // A local response type (anything not a contract *Dto) passed to `apiClient.get<T>(...)` hides a contract mismatch
  // from tsc (CLN-036). Screens call the typed `*Api` classes from shared-app instead.
  {
    files: ['packages/mobile/src/presentation/**/*.{ts,tsx}'],
    ignores: ['packages/mobile/src/presentation/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^(get|post|put|patch|delete)$/][typeArguments]:not([typeArguments.params.0.typeName.name=/Dto$/])",
          message:
            'Type an HTTP response with a generated contract *Dto from shared-app/contract (or call a typed *Api class), never a local type.',
        },
      ],
    },
  },

  // ─── Integration tests + __tests__ dirs: non-type-aware linting only ───────
  // These files may import packages not in the main tsconfig (e.g. @testcontainers,
  // eslint RuleTester fixtures); type-aware rules are disabled for them.
  {
    files: ['**/src/test/integration/**/*.ts', '**/__tests__/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
      },
    },
  },

  // ─── Playwright e2e tests: non-type-aware linting only ───────────────────
  // e2e files are not part of the main tsconfig; type-aware rules are disabled.
  {
    files: ['**/e2e/**/*.ts', '**/e2e-web/**/*.ts', '**/playwright.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
      },
    },
  },
];
