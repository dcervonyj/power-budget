import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

/** True when the OS asks for reduced motion (Reanimated flag or AccessibilityInfo). */
export function useReducedMotion(): boolean {
  const reanimatedReduced = useReanimatedReducedMotion();
  const [a11yReduced, setA11yReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setA11yReduced(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setA11yReduced);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reanimatedReduced || a11yReduced;
}

/** True while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return active;
}

/** Idle loops run only while the app is active and reduced motion is off. */
export function useLoopsEnabled(): boolean {
  const reduced = useReducedMotion();
  const active = useAppActive();

  return active && !reduced;
}
