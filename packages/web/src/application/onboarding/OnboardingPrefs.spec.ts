import { describe, expect, it, vi } from 'vitest';
import { persistOnboardingPrefs } from './OnboardingPrefs.js';

function recordingStorage(): { storage: Storage; saved: Record<string, string> } {
  const saved: Record<string, string> = {};
  const storage = { setItem: vi.fn((key: string, value: string) => (saved[key] = value)) };

  return { storage: Object.assign(Object.create(Storage.prototype), storage), saved };
}

describe('persistOnboardingPrefs', () => {
  it('stores currency, tracked currencies and a supported language', () => {
    const { storage, saved } = recordingStorage();

    persistOnboardingPrefs(storage, {
      baseCurrency: 'PLN',
      interestingCurrencies: ['EUR', 'USD'],
      language: 'pl',
    });

    expect(saved).toEqual({
      pb_base_currency: 'PLN',
      pb_interesting_currencies: '["EUR","USD"]',
      pb_locale: 'pl',
    });
  });

  it('does not store an unsupported language', () => {
    const { storage, saved } = recordingStorage();

    persistOnboardingPrefs(storage, {
      baseCurrency: 'USD',
      interestingCurrencies: [],
      language: 'de',
    });

    expect(saved).toEqual({ pb_base_currency: 'USD', pb_interesting_currencies: '[]' });
  });
});
