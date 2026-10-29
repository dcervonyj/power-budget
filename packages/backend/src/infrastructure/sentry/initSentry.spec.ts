import { createMock } from '@golevelup/ts-vitest';
import { sentryScrubOptions } from '@power-budget/core';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/AppConfig.js';
import { initSentry } from './initSentry.js';

vi.mock('@sentry/node', () => ({ init: vi.fn() }));
import { init } from '@sentry/node';

describe('initSentry', () => {
  it('passes all scrub hooks to Sentry', () => {
    initSentry(
      createMock<AppConfig>({ sentryDsn: 'dsn', nodeEnv: 'production', sentryRelease: 'v1' }),
    );
    expect(init).toHaveBeenCalledWith({
      dsn: 'dsn',
      environment: 'production',
      release: 'v1',
      ...sentryScrubOptions,
    });
  });
});
