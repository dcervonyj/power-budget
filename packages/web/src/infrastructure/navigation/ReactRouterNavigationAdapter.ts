import type { NavigationPort } from '@power-budget/shared-app/infrastructure';
import type { AppRoute } from '@power-budget/shared-app/contract';

// NavigationPort adapter using react-router-dom's imperative API
// Wired at app bootstrap — not imported directly by components
export class ReactRouterNavigationAdapter implements NavigationPort {
  // navigate is provided at runtime via setNavigate()
  private _navigate: ((path: string) => void) | null = null;

  setNavigate(navigate: (path: string) => void): void {
    this._navigate = navigate;
  }

  private routeToPath(route: AppRoute): string {
    switch (route.type) {
      case 'auth/login':
        return '/login';
      case 'auth/register':
        return '/register';
      case 'auth/magic-link':
        return '/magic-link';
      case 'auth/totp-enrolment':
        return '/totp-enrolment';
      case 'onboarding':
        return '/onboarding';
      case 'dashboard':
        return route.planId ? `/dashboard/${route.planId}` : '/dashboard';
      case 'transactions':
        return '/transactions';
      case 'plans':
        return '/plans';
      case 'plans/editor':
        return `/plans/${route.planId}/edit`;
      case 'bank-connections':
        return '/bank-connections';
      case 'bank-connections/add':
        return '/bank-connections/add';
      case 'categories':
        return '/categories';
      case 'settings':
        return '/settings';
    }
  }

  navigate(route: AppRoute): void {
    this._navigate?.(this.routeToPath(route));
  }

  replace(route: AppRoute): void {
    this._navigate?.(this.routeToPath(route));
  }

  goBack(): void {
    window.history.back();
  }
}
