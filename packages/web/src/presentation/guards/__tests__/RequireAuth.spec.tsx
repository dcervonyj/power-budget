import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../RequireAuth.js';
import { tokenStore } from '../../../AppProviders.js';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login screen</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<p>dashboard screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }
}

describe('RequireAuth', () => {
  // Node 25+ ships its own (disabled) localStorage that hides jsdom's; use a plain one.
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the protected route when the token store has an access token', async () => {
    await tokenStore.setTokens('access', 'refresh');

    renderAt('/dashboard');

    expect(screen.getByText('dashboard screen')).toBeDefined();
  });

  it('redirects to /login without an access token', () => {
    renderAt('/dashboard');

    expect(screen.getByText('login screen')).toBeDefined();
  });

  it('ignores the legacy access_token key the guard used to read', () => {
    localStorage.setItem('access_token', 'stale');

    renderAt('/dashboard');

    expect(screen.getByText('login screen')).toBeDefined();
  });
});
