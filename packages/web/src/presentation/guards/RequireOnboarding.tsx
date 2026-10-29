import React, { useContext, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onboardingProgress, onboardingService, settingsStore } from '../../composition.js';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';
import { LocaleContext } from '../../AppProviders.js';
import { isSupportedLocale } from '../../application/onboarding/OnboardingOptions.js';
import { Button } from '../components/Button.js';

type GateState = 'checking' | 'completed' | 'needed' | 'failed';

/**
 * Screens the wizard links to ("Connect now", "Create plan"): open to an unfinished user only
 * after the wizard's own link was followed. A direct URL does not count.
 */
const WIZARD_DESTINATIONS: readonly string[] = [ROUTE_PATHS.bankConnections, ROUTE_PATHS.plans];

function isWizardDestination(pathname: string): boolean {
  return WIZARD_DESTINATIONS.some(
    (destination) => pathname === destination || pathname.startsWith(`${destination}/`),
  );
}

function cacheLocale(locale: string): void {
  try {
    localStorage.setItem('pb_locale', locale);
  } catch {
    // Only a device cache; the profile still has it.
  }
}

function isOpenFromWizard(pathname: string): boolean {
  return onboardingProgress.isLeftForLink && isWizardDestination(pathname);
}

/**
 * Sends a signed-in user who has not completed onboarding to the wizard (CLN-073). The gate stays
 * closed until the profile is read: a failed read shows an error with Retry, it never lets the
 * user through.
 */
export function RequireOnboarding(): React.JSX.Element | null {
  const location = useLocation();
  const { setLocale } = useContext(LocaleContext);
  const [state, setState] = useState<GateState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    onboardingService.readProfile().then(
      (profile) => {
        if (!cancelled) {
          // The profile is the source of truth for tracked currencies: they are in place before
          // the app renders, also on a browser that has never seen this user.
          settingsStore.hydrateFromProfile(profile);
          // Same for the language: a completed user on another browser keeps the chosen one.
          if (profile.localePreference !== null && isSupportedLocale(profile.localePreference)) {
            setLocale(profile.localePreference);
            cacheLocale(profile.localePreference);
          }
          setState(profile.onboardingCompleted ? 'completed' : 'needed');
        }
      },
      () => {
        if (!cancelled) {
          setState('failed');
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt, setLocale]);

  if (state === 'checking') {
    return null;
  }
  if (state === 'failed') {
    return (
      <div role="alert" style={{ padding: 'var(--pb-glass-space-lg)' }}>
        <p>
          <FormattedMessage
            id="onboarding.profileError"
            defaultMessage="Failed to load your profile"
          />
        </p>
        <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>
          <FormattedMessage id="common.retry" defaultMessage="Retry" />
        </Button>
      </div>
    );
  }
  if (state === 'needed' && !isOpenFromWizard(location.pathname)) {
    return <Navigate to={ROUTE_PATHS.onboarding} replace />;
  }

  return <Outlet />;
}
