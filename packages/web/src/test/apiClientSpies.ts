import { vi } from 'vitest';
import { apiClient } from '../composition.js';

const EMPTY_RESPONSE = { status: 200, data: undefined, headers: {} };

/**
 * Spies on the real API client of the composition root, so a spec drives the app's own
 * stores and screens without a module mock. Every method answers an empty 200 until the
 * spec says otherwise, so nothing reaches the network.
 */
export function spyOnApiClient() {
  return {
    request: vi.spyOn(apiClient, 'request').mockResolvedValue(EMPTY_RESPONSE),
    get: vi.spyOn(apiClient, 'get').mockResolvedValue(EMPTY_RESPONSE),
    post: vi.spyOn(apiClient, 'post').mockResolvedValue(EMPTY_RESPONSE),
    put: vi.spyOn(apiClient, 'put').mockResolvedValue(EMPTY_RESPONSE),
    patch: vi.spyOn(apiClient, 'patch').mockResolvedValue(EMPTY_RESPONSE),
    delete: vi.spyOn(apiClient, 'delete').mockResolvedValue(EMPTY_RESPONSE),
  };
}
