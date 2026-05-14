import type { AppRoute } from '../../contract/routes.js';

export interface NavigationPort {
  navigate(route: AppRoute): void;
  replace(route: AppRoute): void;
  goBack(): void;
}
