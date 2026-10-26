import React, { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  matchPath,
  useLocation,
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from 'react-router-dom';
import type { AppRoute } from '@power-budget/shared-app/contract';
import { ReactRouterNavigationAdapter } from '../ReactRouterNavigationAdapter.js';
import { ROUTE_PATHS } from '../routePaths.js';
import { returnPath } from '../../../presentation/guards/returnPath.js';

const EXPECTED_PATHS: ReadonlyArray<[AppRoute, string]> = [
  [{ type: 'auth/login' }, '/login'],
  [{ type: 'auth/register' }, '/register'],
  [{ type: 'auth/magic-link' }, '/auth/magic-link'],
  [{ type: 'auth/totp-enrolment' }, '/auth/totp-enroll'],
  [{ type: 'onboarding' }, '/onboarding'],
  [{ type: 'dashboard' }, '/dashboard'],
  [{ type: 'dashboard', planId: 'p1' }, '/plans/p1/dashboard'],
  [{ type: 'transactions' }, '/transactions'],
  [{ type: 'transactions', filters: { status: 'unplanned' } }, '/transactions?status=unplanned'],
  [{ type: 'plans' }, '/plans'],
  [{ type: 'plans/editor', planId: 'p1' }, '/plans/p1'],
  [{ type: 'bank-connections' }, '/bank-connections'],
  [{ type: 'bank-connections/add' }, '/bank-connections/new'],
  [{ type: 'categories' }, '/categories'],
  [{ type: 'settings' }, '/settings'],
];

interface NavigateCall {
  to: To | number;
  options: NavigateOptions | undefined;
}

function adapterRecordingInto(calls: NavigateCall[]): ReactRouterNavigationAdapter {
  const adapter = new ReactRouterNavigationAdapter();
  adapter.setNavigate(recordingNavigate(calls));

  return adapter;
}

function recordingNavigate(calls: NavigateCall[]): NavigateFunction {
  return (to: To | number, options?: NavigateOptions): void => {
    calls.push({ to, options });
  };
}

function matchesRouteTable(url: string): boolean {
  const pathname = url.split('?')[0] ?? url;

  return Object.values(ROUTE_PATHS).some((pattern) => matchPath(pattern, pathname) !== null);
}

describe('ReactRouterNavigationAdapter', () => {
  it.each(EXPECTED_PATHS)('maps %j to %s, a path of the route table', (route, path) => {
    const calls: NavigateCall[] = [];

    adapterRecordingInto(calls).navigate(route);

    expect(calls).toEqual([{ to: path, options: {} }]);
    expect(matchesRouteTable(path)).toBe(true);
  });

  it('replaces the history entry on replace()', () => {
    const calls: NavigateCall[] = [];

    adapterRecordingInto(calls).replace({ type: 'plans' });

    expect(calls).toEqual([{ to: '/plans', options: { replace: true } }]);
  });

  it('keeps the current location in state.from when the session ends', () => {
    const calls: NavigateCall[] = [];
    const adapter = adapterRecordingInto(calls);
    adapter.setLocation({ pathname: '/plans/p1', search: '?tab=items' });

    adapter.replace({ type: 'auth/login', returnToCurrent: true });

    expect(calls).toEqual([
      {
        to: '/login',
        options: {
          replace: true,
          state: { from: { pathname: '/plans/p1', search: '?tab=items' } },
        },
      },
    ]);
  });

  it('does not ask to come back to a public auth screen', () => {
    const calls: NavigateCall[] = [];
    const adapter = adapterRecordingInto(calls);
    adapter.setLocation({ pathname: '/register', search: '' });

    adapter.replace({ type: 'auth/login', returnToCurrent: true });

    expect(calls).toEqual([{ to: '/login', options: { replace: true } }]);
  });

  it('brings the user back to the screen where the session ended', () => {
    const adapter = new ReactRouterNavigationAdapter();
    render(
      <MemoryRouter initialEntries={['/plans/p1?tab=items']}>
        <Wirer adapter={adapter} />
        <Routes>
          <Route path={ROUTE_PATHS.login} element={<ReturnPathProbe />} />
          <Route path={ROUTE_PATHS.planEditor} element={<p>plan editor</p>} />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      adapter.replace({ type: 'auth/login', returnToCurrent: true });
    });

    expect(screen.getByText('return to /plans/p1?tab=items')).toBeDefined();
  });
});

function Wirer({ adapter }: { adapter: ReactRouterNavigationAdapter }): null {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    adapter.setNavigate(navigate);
  }, [adapter, navigate]);

  useEffect(() => {
    adapter.setLocation(location);
  }, [adapter, location]);

  return null;
}

function ReturnPathProbe(): React.JSX.Element {
  const location = useLocation();

  return <p>{`return to ${returnPath(location.state)}`}</p>;
}
