import type { AppRoute } from '../../contract/routes.js';

export interface Navigator {
  navigate(route: AppRoute): void;
  replace(route: AppRoute): void;
  goBack(): void;
}
