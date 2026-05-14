import { ApiClient } from '@power-budget/shared-app';
import type { SecureTokenStore } from '@power-budget/shared-app';

export function createApiClient(
  tokenStore: SecureTokenStore,
  onUnauthenticated?: () => void,
): ApiClient {
  return new ApiClient(
    import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000',
    tokenStore,
    onUnauthenticated,
  );
}
