import { sentryScrubOptions } from '@power-budget/core';
import { describe, expect, it, vi } from 'vitest';
import { initSentry } from './initSentry.js';

vi.mock('@sentry/react-native', () => ({ init: vi.fn() }));
import { init } from '@sentry/react-native';

describe('initSentry', () => {
  it('passes all scrub hooks to Sentry', () => {
    initSentry('dsn');
    expect(init).toHaveBeenCalledWith({
      dsn: 'dsn',
      ...sentryScrubOptions,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
    });
  });
});
