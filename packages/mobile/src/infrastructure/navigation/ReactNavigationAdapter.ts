import type { NavigationPort } from '@power-budget/shared-app/infrastructure';
import type { AppRoute } from '@power-budget/shared-app/contract';

export class ReactNavigationAdapter implements NavigationPort {
  // Provided at runtime by the root navigator ref
  private _ref: { navigate: (name: string, params?: object) => void; goBack: () => void } | null =
    null;

  setRef(ref: { navigate: (name: string, params?: object) => void; goBack: () => void }): void {
    this._ref = ref;
  }

  navigate(route: AppRoute): void {
    if (!this._ref) return;
    const [screen, params] = this.routeToScreen(route);
    this._ref.navigate(screen, params);
  }

  replace(route: AppRoute): void {
    this.navigate(route);
  }

  goBack(): void {
    this._ref?.goBack();
  }

  private routeToScreen(route: AppRoute): [string, object | undefined] {
    switch (route.type) {
      case 'auth/login':
        return ['Login', undefined];
      case 'auth/register':
        return ['Register', undefined];
      case 'auth/magic-link':
        return ['MagicLink', undefined];
      case 'auth/totp-enrolment':
        return ['TotpEnrolment', undefined];
      case 'onboarding':
        return ['Onboarding', undefined];
      case 'dashboard':
        return ['Dashboard', route.planId ? { planId: route.planId } : undefined];
      case 'transactions':
        return ['Transactions', undefined];
      case 'plans':
        return ['Plans', undefined];
      case 'plans/editor':
        return ['PlanEditor', { planId: route.planId }];
      case 'bank-connections':
        return ['BankConnections', undefined];
      case 'bank-connections/add':
        return ['AddBankConnection', undefined];
      case 'categories':
        return ['Categories', undefined];
      case 'settings':
        return ['Settings', undefined];
      default: {
        const _exhaustive: never = route;
        throw new Error(`Unhandled route: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
