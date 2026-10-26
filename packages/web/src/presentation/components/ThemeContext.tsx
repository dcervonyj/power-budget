// Compatibility re-export: `useTheme()` here keeps returning the token object that existing
// components read. New code uses `useTheme()` from `presentation/theme` (preference, resolved, setter).
export { ThemeProvider } from '../theme/ThemeProvider.js';
export { useThemeTokens as useTheme } from '../theme/ThemeProvider.js';
