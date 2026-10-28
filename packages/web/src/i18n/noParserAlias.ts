/**
 * Swaps the ICU parser for its parse-less build: every message reaches react-intl as a
 * precompiled AST. The target must be the same `@formatjs/icu-messageformat-parser` version
 * that `intl-messageformat` (via react-intl) resolves, otherwise the AST format can drift, so
 * the devDependency in package.json stays pinned to that version (CLN-074d).
 */
export const NO_PARSER_ALIAS = {
  '@formatjs/icu-messageformat-parser': '@formatjs/icu-messageformat-parser/no-parser.js',
};
