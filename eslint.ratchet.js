// @ts-check
const fs = require('fs');
const path = require('path');
// Style ratchet (CLN-062, audit findings STYLE-02/06/08/09, SUMMARY #55/#56).
// Rules are enabled per package so each package can be brought to green and merged independently:
// set `"eslintRatchet": true` in the package's package.json once the package is green.

const PACKAGES_DIR = path.join(__dirname, 'packages');

/** A package opts in with `"eslintRatchet": true` in its package.json, so each package can be ratcheted in its own PR. */
function isRatcheted(pkg) {
  try {
    return (
      JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, pkg, 'package.json'), 'utf8'))
        .eslintRatchet === true
    );
  } catch {
    return false;
  }
}

const RATCHET_PACKAGES = fs.readdirSync(PACKAGES_DIR).filter(isRatcheted);

const TYPE_AWARE_IGNORES = [
  '**/src/test/integration/**',
  '**/__tests__/**',
  '**/vite.config.ts',
  '**/vitest.config.ts',
  '**/e2e/**',
  '**/e2e-web/**',
  '**/playwright.config.ts',
];

const styleRules = {
  curly: ['error', 'all'],
  'padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
  '@typescript-eslint/member-ordering': [
    'error',
    {
      default: {
        memberTypes: [
          'signature',
          'field',
          'constructor',
          'public-method',
          'protected-method',
          'private-method',
        ],
        order: 'as-written',
      },
    },
  ],
  // No *Helper names for any identifier (CLAUDE.md "Naming").
  '@typescript-eslint/naming-convention': [
    'error',
    { selector: 'default', format: null, custom: { regex: 'Helper', match: false } },
  ],
  // `@typescript-eslint/no-restricted-imports` is a separate rule id, so it does not clash with the per-layer
  // `no-restricted-imports` config (CLN-061). Use `lodash-es` only.
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      paths: [{ name: 'lodash', message: 'Use lodash-es, never lodash.' }],
      patterns: [{ group: ['lodash/*'], message: 'Use lodash-es, never lodash.' }],
    },
  ],
};

const typeAwareRules = {
  '@typescript-eslint/switch-exhaustiveness-check': ['error', { requireDefaultForNonUnion: false }],
};

/**
 * Blocks for one package. `prefix` is the path of the package relative to the config file's directory:
 * `packages/<pkg>/` from the root config, '' from a package-local config.
 * @param {string} prefix
 * @returns {import('eslint').Linter.FlatConfig[]}
 */
function ratchetFor(prefix) {
  const files = [`${prefix}**/*.ts`, `${prefix}**/*.tsx`];

  return [
    { files, rules: styleRules },
    { files, ignores: TYPE_AWARE_IGNORES, rules: typeAwareRules },
  ];
}

/** Root config: every enabled package (packages with their own config re-apply via `ratchetFor('')`). */
const ratchetBlocks = RATCHET_PACKAGES.flatMap((pkg) => ratchetFor(`packages/${pkg}/`));

/** For a package-local config: enabled only when the package is listed. */
const ratchetForPackage = (pkg) => (RATCHET_PACKAGES.includes(pkg) ? ratchetFor('') : []);

module.exports = { RATCHET_PACKAGES, ratchetBlocks, ratchetForPackage, styleRules, typeAwareRules };
