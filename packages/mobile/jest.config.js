module.exports = {
  preset: 'jest-expo',
  // The first suite pays the cold babel transform (~20s on CI), which tripped the 5s default.
  testTimeout: 30000,
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    // DSN-031: native-only modules have no jest runtime; glass components are tested on these mocks.
    '^react-native-reanimated$': '<rootDir>/src/gallery/testing/reanimated.mock.js',
    '^@shopify/react-native-skia$': '<rootDir>/src/gallery/testing/skia.mock.js',
    '^expo-blur$': '<rootDir>/src/gallery/testing/blur.mock.js',
    '^@power-budget/design-tokens/glass$': '<rootDir>/../design-tokens/src/glass/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-reanimated|react-native-worklets|react-intl|@formatjs/.*|intl-messageformat))',
  ],
};
