import type { Navigator } from '@power-budget/shared-app/infrastructure';
import type { AppRoute } from '@power-budget/shared-app/contract';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import type {
  AppStackParamList,
  AppTabParamList,
  AuthStackParamList,
} from '../../presentation/navigation/types.js';

export class ReactNavigationAdapter implements Navigator {
  // Provided at runtime by the root navigator ref
  private _ref: { navigate: (name: string, params?: object) => void; goBack: () => void } | null =
    null;

  setRef(ref: { navigate: (name: string, params?: object) => void; goBack: () => void }): void {
    this._ref = ref;
  }

  navigate(route: AppRoute): void {
    if (!this._ref) {
      return;
    }
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
        return authScreen('Login');
      case 'auth/register':
        return authScreen('Register');
      case 'auth/magic-link':
        return authScreen('MagicLink');
      case 'auth/totp-enrolment':
        return authScreen('TotpEnrollment');
      // Mobile has no onboarding screen; the dashboard is the post-login landing screen.
      case 'onboarding':
        return tabScreen('Dashboard', undefined);
      case 'dashboard':
        return tabScreen('Dashboard', route.planId ? { planId: route.planId } : undefined);
      case 'transactions':
        return tabScreen('Transactions', undefined);
      case 'plans':
        return tabScreen('Plans', undefined);
      case 'plans/editor':
        return stackScreen('PlanEditor', { planId: route.planId });
      case 'bank-connections':
        return stackScreen('BankConnections', undefined);
      case 'bank-connections/add':
        return stackScreen('AddBankConnection', undefined);
      case 'categories':
        return stackScreen('Categories', undefined);
      case 'settings':
        return tabScreen('Settings', undefined);
      default: {
        const _exhaustive: never = route;
        throw new Error(`Unhandled route: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}

// react-navigation v7 only navigates to a screen of a nested navigator through the parent
// screen with `{ screen, params }`; a bare leaf name is not resolved across navigators.
function authScreen(screen: keyof AuthStackParamList): [string, object] {
  return ['Auth', { screen }];
}

function stackScreen(
  screen: keyof AppStackParamList,
  params: object | undefined,
): [string, object] {
  return ['App', { screen, params }];
}

function tabScreen(screen: keyof AppTabParamList, params: object | undefined): [string, object] {
  return ['App', { screen: 'Tabs', params: { screen, params } }];
}
