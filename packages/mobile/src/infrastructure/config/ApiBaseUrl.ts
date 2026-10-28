export const PRODUCTION_API_BASE_URL = 'https://power-budget-api-eu.onrender.com';
export const DEVELOPMENT_API_BASE_URL = 'http://localhost:3000';

/**
 * Picks the API base URL: an explicit Expo public env value (EXPO_PUBLIC_API_URL, set per
 * EAS build profile or in .env) wins; without one, dev builds talk to a local API and every
 * other build (preview/production) to the hosted EU API.
 */
export function resolveApiBaseUrl(configured: string | undefined, isDevelopment: boolean): string {
  // Kept: an unset env value means "use the default URL", the documented contract above.
  const trimmed = configured?.trim() ?? '';
  if (trimmed !== '') {
    return trimmed.replace(/\/+$/, '');
  }

  return isDevelopment ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL;
}
