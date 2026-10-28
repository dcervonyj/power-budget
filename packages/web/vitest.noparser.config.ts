import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { precompiledMessages } from './src/i18n/precompiledMessages.js';
import { NO_PARSER_ALIAS } from './src/i18n/noParserAlias.js';

// Mirrors the production pipeline (alias, babel-plugin-formatjs AST, precompiled locale JSON)
// for the one spec that proves messages format without the ICU parser (CLN-074d).
export default defineConfig({
  plugins: [
    react({ babel: { plugins: [['formatjs', { ast: true, preserveWhitespace: true }]] } }),
    precompiledMessages(),
  ],
  resolve: { alias: NO_PARSER_ALIAS },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/noParser.spec.tsx', 'src/test/bundleNoParser.spec.ts'],
    server: {
      deps: {
        inline: [/intl-messageformat/, /react-intl/, /@formatjs\/(?!icu-messageformat-parser\/no)/],
      },
    },
  },
});
