// @ts-check
// Backend-specific ESLint flat config.
// Extends the root monorepo config and adds the local `no-repo-without-scope` rule.
const rootConfig = require('../../eslint.config.js');
const localRules = require('./eslint-local-rules.cjs');
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...rootConfig,
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
