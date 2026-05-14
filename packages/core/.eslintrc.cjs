// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'react', message: 'core is framework-agnostic — no React (ARCHITECTURE.md §4).' },
          { name: 'react-dom', message: 'core is framework-agnostic — no React.' },
          { name: 'react-native', message: 'core is framework-agnostic — no React Native.' },
          { name: 'express', message: 'core has no I/O — no Express.' },
          { name: 'fastify', message: 'core has no I/O — no Fastify.' },
          { name: 'axios', message: 'core has no I/O — no HTTP clients.' },
          { name: 'drizzle-orm', message: 'core has no DB access — no Drizzle.' },
          { name: 'fs', message: 'core has no I/O — no Node fs.' },
          { name: 'path', message: 'core has no I/O — no Node path.' },
          { name: 'os', message: 'core has no I/O — no Node os.' },
          { name: 'crypto', message: 'core has no I/O — no Node crypto.' },
          { name: 'http', message: 'core has no I/O — no Node http.' },
          { name: 'https', message: 'core has no I/O — no Node https.' },
          { name: 'stream', message: 'core has no I/O — no Node stream.' },
          { name: 'buffer', message: 'core has no I/O — no Node Buffer; use Uint8Array.' },
        ],
        patterns: [
          {
            group: ['@nestjs/*'],
            message: 'core is framework-agnostic — no NestJS (ARCHITECTURE.md §4).',
          },
          { group: ['node:*'], message: 'core has no Node-specific imports.' },
          {
            group: ['@power-budget/backend', '@power-budget/web', '@power-budget/mobile'],
            message: 'core must not depend on any app package; dependency flows inward.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['scripts/**/*.mjs', 'tsup.config.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};

