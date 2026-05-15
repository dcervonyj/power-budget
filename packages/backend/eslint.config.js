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
      'local-rules/no-repo-without-scope': 'error',
    },
  },
];
