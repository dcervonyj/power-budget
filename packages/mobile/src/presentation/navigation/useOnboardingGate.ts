import { useCallback, useEffect, useState } from 'react';

export type OnboardingGateStatus = 'checking' | 'needed' | 'completed';

export interface OnboardingStatusSource {
  isCompleted(): Promise<boolean>;
}

export interface OnboardingGate {
  readonly status: OnboardingGateStatus;
  /** The user finished onboarding: the gate opens without another request. */
  markCompleted(): void;
}

/**
 * Whether the signed-in user still has to go through onboarding (CLN-073). Re-reads the profile
 * on every sign-in. A failed read lets the user through: it must not lock anyone out.
 */
export function useOnboardingGate(
  authenticated: boolean,
  source: OnboardingStatusSource,
): OnboardingGate {
  const [status, setStatus] = useState<OnboardingGateStatus>('checking');
  const markCompleted = useCallback((): void => {
    setStatus('completed');
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setStatus('checking');

      return undefined;
    }
    let cancelled = false;
    const apply = (next: OnboardingGateStatus): void => {
      if (!cancelled) {
        setStatus(next);
      }
    };
    source.isCompleted().then(
      (completed) => {
        apply(completed ? 'completed' : 'needed');
      },
      () => {
        apply('completed');
      },
    );

    return (): void => {
      cancelled = true;
    };
  }, [authenticated, source]);

  return { status, markCompleted };
}
