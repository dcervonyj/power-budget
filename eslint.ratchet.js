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
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
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

const HELPER_NAME = 'Helpers?$';

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
  // No *Helper names and no `I` interface prefix. Declarations only: imports, object-literal keys and
  // third-party property names (FormHelperText, isHelperVisible) are not checked. File names are not enforced.
  // One entry per selector: the most specific entry wins, so the interface entry carries both patterns.
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: [
        'class',
        'typeAlias',
        'enum',
        'typeParameter',
        'function',
        'variable',
        'parameter',
        'classMethod',
        'classProperty',
      ],
      format: null,
      custom: { regex: HELPER_NAME, match: false },
    },
    {
      selector: 'interface',
      format: null,
      custom: { regex: `^I[A-Z]|${HELPER_NAME}`, match: false },
    },
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
 * Directory-level ratchets (CLN-074): rules for part of one ratcheted package, as `[files, ignores, rules]`, paths
 * relative to the package. They live here, not in the package config, so the root config (the pre-commit
 * `eslint --fix`) sees the same rules; otherwise it would strip the `eslint-disable` comments as unused.
 */
const DIRECTORY_RATCHETS = {
  // STYLE-03/05: Drizzle ids are branded in drizzle/schema.ts, so infrastructure maps rows without `as`.
  // A cast with no other way gets a one-line `eslint-disable-next-line` with the reason.
  backend: [
    {
      files: [
        'src/infrastructure/**/*.ts',
        'src/application/**/*.ts',
        'src/presentation/**/*.ts',
        'src/domain/**/*.ts',
        'src/worker/**/*.ts',
      ],
      ignores: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      },
    },
    {
      // CLN-074e: backend tests build typed fixtures instead of casting.
      files: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**/*.ts',
        'src/test/**/*.ts',
      ],
      // CLN-074f cleared the baseline: a cast with no other way gets a one-line `eslint-disable-next-line`.
      ignores: [],
      rules: {
        '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      },
    },
  ],
};

/**
 * Ratchet blocks for the config file that lives in `baseDir`. ESLint matches `files` relative to the config
 * file's directory, so the root config passes the repo root (`packages/<pkg>/**`) and a package-local config
 * passes its own directory (`**`). Each config file calls this once; nobody re-spreads another config's blocks.
 * @param {string} baseDir
 * @returns {import('eslint').Linter.FlatConfig[]}
 */
function ratchetBlocks(baseDir) {
  return RATCHET_PACKAGES.flatMap((pkg) => {
    const relative = path.relative(baseDir, path.join(PACKAGES_DIR, pkg));

    return relative.startsWith('..')
      ? []
      : [
          ...ratchetFor(relative === '' ? '' : `${relative}/`),
          ...directoryBlocks(pkg, relative === '' ? '' : `${relative}/`),
        ];
  });
}

function directoryBlocks(pkg, prefix) {
  return (DIRECTORY_RATCHETS[pkg] ?? []).map((block) => ({
    files: block.files.map((file) => `${prefix}${file}`),
    ignores: block.ignores.map((glob) => (glob.startsWith('**/') ? glob : `${prefix}${glob}`)),
    rules: block.rules,
  }));
}

function ratchetFor(prefix) {
  const files = [`${prefix}**/*.ts`, `${prefix}**/*.tsx`];

  return [
    { files, rules: styleRules },
    // Same file set as the type-aware parser block in eslint.base.js, so the rule only runs where type info exists.
    { files, ignores: TYPE_AWARE_IGNORES, rules: typeAwareRules },
  ];
}

module.exports = {
  RATCHET_PACKAGES,
  TYPE_AWARE_IGNORES,
  ratchetBlocks,
  styleRules,
  typeAwareRules,
};
