import React, { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onboardingService } from '../../composition.js';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';
import { Button } from '../components/Button.js';

type GateState = 'checking' | 'completed' | 'needed' | 'failed';

/**
 * Screens the wizard links to ("Connect now", "Create plan"): open while onboarding is not
 * finished, so those links do not bounce the user back to the wizard.
 */
const WIZARD_DESTINATIONS: readonly string[] = [ROUTE_PATHS.bankConnections, ROUTE_PATHS.plans];

function isWizardDestination(pathname: string): boolean {
  return WIZARD_DESTINATIONS.some(
    (destination) => pathname === destination || pathname.startsWith(`${destination}/`),
  );
}

/**
 * Sends a signed-in user who has not completed onboarding to the wizard (CLN-073). The gate stays
 * closed until the profile is read: a failed read shows an error with Retry, it never lets the
 * user through.
 */
export function RequireOnboarding(): React.JSX.Element | null {
  const location = useLocation();
  const [state, setState] = useState<GateState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    onboardingService.isCompleted().then(
      (completed) => {
        if (!cancelled) {
          setState(completed ? 'completed' : 'needed');
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
  }, [attempt]);

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
  if (state === 'needed' && !isWizardDestination(location.pathname)) {
    return <Navigate to={ROUTE_PATHS.onboarding} replace />;
  }

  return <Outlet />;
}
