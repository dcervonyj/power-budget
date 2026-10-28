// @ts-check
// Backend-specific ESLint flat config.
// Extends the root monorepo config and adds the local `no-repo-without-scope` rule.
const rootConfig = require('../../eslint.base.js');
const { ratchetBlocks } = require('../../eslint.ratchet.js');
const { backendLayerBlocks } = require('../../eslint.layers.js');
const localRules = require('./eslint-local-rules.cjs');
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...rootConfig,
  ...ratchetBlocks(__dirname),
  // Root layer globs are relative to the repo root and do not match here; re-apply them for this base dir (CLN-061).
  ...backendLayerBlocks(''),
  // __tests__/** are vitest fixtures, not part of the main tsconfig — disable type-aware rules.
  {
    files: ['__tests__/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
      },
    },
  },
  // CLN-074a (STYLE-03/05): no type assertions in infrastructure production code. Ids are branded in the Drizzle
  // schema, so repositories map rows without casts. Where no other way exists, disable per line with a reason.
  {
    files: ['src/infrastructure/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    files: ['**/*.ts'],
    plugins: {
      'local-rules': localRules,
    },
    rules: {
      'local-rules/no-repo-without-scope': [
        'error',
        {
          // Identity and tenant-root repositories (keyed by user or household id) and user-level
          // currency preferences: no HouseholdScope. FX rates are global (no tenant methods).
          unscopedRepositories: [
            '^(user|userProfile|household|session|totpSecret|magicLinkToken|invite|currencyPreferences)Repo(sitory)?$',
          ],
        },
      ],
    },
  },
];
