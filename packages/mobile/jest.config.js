module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@power-budget/design-tokens/glass$': '<rootDir>/../design-tokens/src/glass/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-reanimated|react-native-worklets|react-intl|@formatjs/.*|intl-messageformat))',
  ],
};
