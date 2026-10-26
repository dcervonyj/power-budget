import { generatePath, type NavigateFunction, type NavigateOptions } from 'react-router-dom';
import type { Navigator } from '@power-budget/shared-app/infrastructure';
import type { AppRoute } from '@power-budget/shared-app/contract';
import { PUBLIC_AUTH_PATHS, ROUTE_PATHS } from './routePaths.js';

/** The part of a router location that `RequireAuth` keeps in `state.from`. */
export interface CurrentLocation {
  pathname: string;
  search: string;
}

// Navigator adapter using react-router-dom's imperative API
// Wired at app bootstrap — not imported directly by components
export class ReactRouterNavigationAdapter implements Navigator {
  // navigate and the current location are provided at runtime by NavigationWirer
  private _navigate: NavigateFunction | null = null;
  private _location: CurrentLocation | null = null;

  setNavigate(navigate: NavigateFunction): void {
    this._navigate = navigate;
  }

  setLocation(location: CurrentLocation): void {
    this._location = { pathname: location.pathname, search: location.search };
  }

  navigate(route: AppRoute): void {
    this.go(route, {});
  }

  replace(route: AppRoute): void {
    this.go(route, { replace: true });
  }

  goBack(): void {
    window.history.back();
  }

  private go(route: AppRoute, options: NavigateOptions): void {
    const state = this.stateFor(route);
    this._navigate?.(routeToPath(route), state ? { ...options, state } : options);
  }

  /** Same shape as RequireAuth's redirect, so LoginScreen returns to the page after login. */
  private stateFor(route: AppRoute): { from: CurrentLocation } | null {
    if (route.type !== 'auth/login' || !route.returnToCurrent || !this._location) {
      return null;
    }
    if (PUBLIC_AUTH_PATHS.includes(this._location.pathname)) {
      return null;
    }

    return { from: this._location };
  }
}

function routeToPath(route: AppRoute): string {
  switch (route.type) {
    case 'auth/login':
      return ROUTE_PATHS.login;
    case 'auth/register':
      return ROUTE_PATHS.register;
    case 'auth/magic-link':
      return ROUTE_PATHS.magicLink;
    case 'auth/totp-enrolment':
      return ROUTE_PATHS.totpEnroll;
    case 'onboarding':
      return ROUTE_PATHS.onboarding;
    case 'dashboard':
      return route.planId
        ? generatePath(ROUTE_PATHS.planDashboard, { id: route.planId })
        : ROUTE_PATHS.dashboard;
    case 'transactions':
      return withQuery(ROUTE_PATHS.transactions, route.filters);
    case 'plans':
      return ROUTE_PATHS.plans;
    case 'plans/editor':
      return generatePath(ROUTE_PATHS.planEditor, { id: route.planId });
    case 'bank-connections':
      return ROUTE_PATHS.bankConnections;
    case 'bank-connections/add':
      return ROUTE_PATHS.addBankConnection;
    case 'categories':
      return ROUTE_PATHS.categories;
    case 'settings':
      return ROUTE_PATHS.settings;
    default: {
      const _exhaustive: never = route;

      return String(_exhaustive);
    }
  }
}

function withQuery(path: string, filters: Record<string, string> | undefined): string {
  const query = new URLSearchParams(filters).toString();

  return query ? `${path}?${query}` : path;
}
