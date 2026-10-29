import { useCallback, useEffect, useState } from 'react';

export type OnboardingGateStatus = 'checking' | 'needed' | 'completed' | 'failed';

export interface OnboardingStatusSource {
  isCompleted(): Promise<boolean>;
}

export interface OnboardingGate {
  readonly status: OnboardingGateStatus;
  /** The user finished onboarding: the gate opens without another request. */
  markCompleted(): void;
  /** The profile read failed: read it again. */
  retry(): void;
}

/**
 * Whether the signed-in user still has to go through onboarding (CLN-073). Re-reads the profile
 * on every sign-in. A failed read keeps the gate closed (status 'failed'); retry() reads again.
 */
export function useOnboardingGate(
  authenticated: boolean,
  source: OnboardingStatusSource,
): OnboardingGate {
  const [status, setStatus] = useState<OnboardingGateStatus>('checking');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback((): void => {
    setStatus('checking');
    setAttempt((current) => current + 1);
  }, []);
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
        apply('failed');
      },
    );

    return (): void => {
      cancelled = true;
    };
  }, [authenticated, source, attempt]);

  return { status, markCompleted, retry };
}
