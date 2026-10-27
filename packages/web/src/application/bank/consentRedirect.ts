import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';

/** Where the bank sends the user back after consent: the app's consent callback page. */
export function consentRedirectUri(): string {
  return `${window.location.origin}${ROUTE_PATHS.bankConsentCallback}`;
}

/** Leaves the app for the bank's consent page. */
export function goToConsent(consentUrl: string): void {
  window.location.assign(consentUrl);
}
