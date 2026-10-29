import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onboardingService } from '../../composition.js';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';

type GateState = 'checking' | 'completed' | 'needed';

/**
 * Sends a signed-in user who has not completed onboarding to the wizard (CLN-073). When the
 * profile cannot be read the user is let through: a failed read must not lock anyone out.
 */
export function RequireOnboarding(): React.JSX.Element | null {
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;
    onboardingService.isCompleted().then(
      (completed) => {
        if (!cancelled) {
          setState(completed ? 'completed' : 'needed');
        }
      },
      () => {
        if (!cancelled) {
          setState('completed');
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return null;
  }
  if (state === 'needed') {
    return <Navigate to={ROUTE_PATHS.onboarding} replace />;
  }

  return <Outlet />;
}
