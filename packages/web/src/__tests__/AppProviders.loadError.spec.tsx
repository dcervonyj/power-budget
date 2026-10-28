import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@sentry/react';

vi.mock('../../public/locales/en.json', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

import { AppProviders } from '../AppProviders.js';

describe('AppProviders', () => {
  it('surfaces a failed locale chunk to the surrounding error boundary', async () => {
    localStorage.setItem('pb_locale', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary fallback={<p>boundary reached</p>}>
        <MemoryRouter>
          <AppProviders>
            <p>child</p>
          </AppProviders>
        </MemoryRouter>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText('boundary reached')).toBeTruthy());
  });
});
