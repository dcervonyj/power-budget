// @ts-check
// Style ratchet (CLN-062, audit findings STYLE-02/06/08/09, SUMMARY #55/#56).
// Rules are enabled per package so each package can be brought to green and merged independently:
// list the package in RATCHET_PACKAGES. All six packages were green in one pass (under 400 diff lines), so one list.

const RATCHET_PACKAGES = ['design-tokens', 'core', 'backend', 'shared-app', 'web', 'mobile'];

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
