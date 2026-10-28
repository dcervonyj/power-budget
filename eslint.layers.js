// @ts-check
// Per-layer `no-restricted-imports` (CLN-061, audit finding ARCH-05).
// Clean-architecture direction: domain <- application <- infrastructure / presentation.
// Shared by the root eslint.config.js and by packages/backend/__tests__/layer-lint.spec.ts.

const LAYER_MESSAGE = 'Layer violation: an inner layer must not import an outer layer.';

/** @param {string} layer */
const layerGlob = (layer) => [`**/${layer}`, `**/${layer}/**`];

/** @param {string[]} layers */
const layerPatterns = (layers) => ({
  group: layers.flatMap(layerGlob),
  message: LAYER_MESSAGE,
});

const BACKEND_FRAMEWORKS = {
  paths: [{ name: 'uuidv7', message: 'Inject an IdGenerator port instead of importing uuidv7.' }],
  patterns: [
    { group: ['node:*'], message: 'Node built-ins belong in infrastructure; use a port.' },
    {
      group: ['@nestjs/*', 'drizzle-orm', 'drizzle-orm/*'],
      message: 'Framework imports belong in infrastructure/presentation.',
    },
  ],
};

const CLIENT_FRAMEWORKS = {
  paths: [],
  patterns: [
    {
      group: ['react', 'react-*', 'react/*', 'react-native', 'react-native/*', 'react-dom/*'],
      message: 'UI frameworks belong in presentation.',
    },
  ],
};

/**
 * @param {string[]} files
 * @param {string[]} layers
 * @param {{ paths: object[], patterns: object[] }} frameworks
 */
const block = (files, layers, frameworks) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      { paths: frameworks.paths, patterns: [layerPatterns(layers), ...frameworks.patterns] },
    ],
  },
});

const NONE = { paths: [], patterns: [] };

/**
 * Flat-config `files` globs resolve relative to the config file that holds them, so the backend
 * (which lints with packages/backend/eslint.config.js, base dir packages/backend) needs prefix ''
 * and the root config needs 'packages/backend/'.
 * @param {string} prefix
 * @returns {import('eslint').Linter.Config[]}
 */
const backendLayerBlocks = (prefix) => [
  block(
    [`${prefix}src/domain/**/*.ts`],
    ['application', 'infrastructure', 'presentation', 'bootstrap', 'worker'],
    BACKEND_FRAMEWORKS,
  ),
  block(
    [`${prefix}src/application/**/*.ts`],
    ['infrastructure', 'presentation', 'bootstrap', 'worker'],
    BACKEND_FRAMEWORKS,
  ),
  block([`${prefix}src/infrastructure/**/*.ts`], ['presentation'], NONE),
];

/** @type {import('eslint').Linter.Config[]} */
const layerLintBlocks = [
  ...backendLayerBlocks('packages/backend/'),
  // web + mobile
  block(
    ['packages/{web,mobile}/src/domain/**/*.{ts,tsx}'],
    ['application', 'infrastructure', 'presentation'],
    CLIENT_FRAMEWORKS,
  ),
  block(
    ['packages/web/src/application/**/*.{ts,tsx}'],
    ['infrastructure', 'presentation'],
    CLIENT_FRAMEWORKS,
  ),
  block(['packages/{web,mobile}/src/infrastructure/**/*.{ts,tsx}'], ['presentation'], NONE),
];

// TEMPORARY allow-list (CLN-061): files that already violate a layer rule when the rule landed (29 files).
// No code was moved. Each entry must be fixed and removed in follow-up tickets (move the import behind a port,
// inject IdGenerator/Clock instead of uuidv7/node:crypto, relocate shared types out of presentation, split
// mappers out of infrastructure). Do NOT add entries here: new violations must fail lint.
// Documentation only: each known import carries `// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list`
// on its own line, so a NEW forbidden import in a listed file still errors.
const LAYER_ALLOW_LIST = [
  'packages/backend/src/application/auth/services/HouseholdInviteMailer.ts',
  'packages/backend/src/application/auth/use-cases/ConsumeMagicLinkUseCase.spec.ts',
  'packages/backend/src/application/auth/use-cases/ConsumeMagicLinkUseCase.ts',
  'packages/backend/src/application/auth/use-cases/CreateHouseholdUseCase.ts',
  'packages/backend/src/application/auth/use-cases/ExportHouseholdDataUseCase.ts',
  'packages/backend/src/application/auth/use-cases/InviteToHouseholdUseCase.ts',
  'packages/backend/src/application/auth/use-cases/LoginWithGoogleUseCase.ts',
  'packages/backend/src/application/auth/use-cases/RegisterUserUseCase.ts',
  'packages/backend/src/application/auth/use-cases/RequestMagicLinkUseCase.spec.ts',
  'packages/backend/src/application/auth/use-cases/RequestMagicLinkUseCase.ts',
  'packages/backend/src/application/bank/use-cases/__tests__/CompleteBankConsentUseCase.spec.ts',
  'packages/backend/src/application/bank/use-cases/InitiateBankConnectionUseCase.ts',
  'packages/backend/src/application/notifications/use-cases/EnqueueNotificationUseCase.ts',
  'packages/backend/src/application/plans/use-cases/ClosePeriodSnapshotUseCase.spec.ts',
  'packages/backend/src/domain/transactions/idempotent-ingest.ts',
  'packages/backend/src/infrastructure/sentry/__tests__/SentryExceptionFilter.spec.ts',
  'packages/backend/src/infrastructure/sentry/SentryExceptionFilter.ts',
  'packages/mobile/src/infrastructure/navigation/ReactNavigationAdapter.ts',
  'packages/web/src/application/auth/SignOutSession.spec.ts',
  'packages/web/src/application/bank/BankConnectionStore.ts',
  'packages/web/src/application/bank/consentRedirect.ts',
  'packages/web/src/application/bank/ConsentRenewal.spec.ts',
  'packages/web/src/application/bank/ConsentRenewal.ts',
  'packages/web/src/application/dashboard/PlanDashboardStore.ts',
  'packages/web/src/application/shell/appShellStore.ts',
  'packages/web/src/application/transactions/TransactionListQuery.spec.ts',
  'packages/web/src/application/transactions/TransactionListQuery.ts',
  'packages/web/src/application/transactions/TransactionListQueryView.spec.ts',
  'packages/web/src/infrastructure/navigation/__tests__/ReactRouterNavigationAdapter.spec.tsx',
];

module.exports = { layerLintBlocks, backendLayerBlocks, LAYER_ALLOW_LIST };
