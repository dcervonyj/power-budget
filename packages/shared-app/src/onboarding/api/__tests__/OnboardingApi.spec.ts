import { beforeEach, describe, expect, it } from 'vitest';
import { RecordingHttpClient } from '../../../test/RecordingHttpClient.js';
import { OnboardingApi } from '../OnboardingApi.js';

let http: RecordingHttpClient;
let api: OnboardingApi;

beforeEach(() => {
  http = new RecordingHttpClient();
  api = new OnboardingApi(http);
});

describe('OnboardingApi', () => {
  it('reads completion from GET /users/me', async () => {
    http.respondWith({ onboardingCompleted: false }, { onboardingCompleted: true });

    expect(await api.isCompleted()).toBe(false);
    expect(await api.isCompleted()).toBe(true);
    expect(http.calls).toEqual([
      { method: 'GET', url: '/users/me' },
      { method: 'GET', url: '/users/me' },
    ]);
  });

  it('saves the language, base currency and completion in one PATCH /users/me', async () => {
    await api.complete({ language: 'pl', baseCurrency: 'EUR' });

    expect(http.calls).toEqual([
      {
        method: 'PATCH',
        url: '/users/me',
        body: { onboardingCompleted: true, locale: 'pl', baseCurrency: 'EUR' },
      },
    ]);
  });

  it('still completes when a choice is not one the profile accepts', async () => {
    await api.complete({ language: 'de', baseCurrency: 'JPY' });

    expect(http.calls).toEqual([
      { method: 'PATCH', url: '/users/me', body: { onboardingCompleted: true } },
    ]);
  });
});
