import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from '../ApiBaseUrl.js';

describe('resolveApiBaseUrl', () => {
  it('prefers the configured URL and drops trailing slashes', () => {
    expect(resolveApiBaseUrl(' https://api.example.test// ', false)).toBe(
      'https://api.example.test',
    );
  });

  it('defaults to the hosted EU API for non-development builds', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe(PRODUCTION_API_BASE_URL);
    expect(PRODUCTION_API_BASE_URL).toBe('https://power-budget-api-eu.onrender.com');
  });

  it('defaults to the local API in development', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe(DEVELOPMENT_API_BASE_URL);
  });

  it('treats a blank value as unset', () => {
    expect(resolveApiBaseUrl('  ', false)).toBe(PRODUCTION_API_BASE_URL);
  });
});
