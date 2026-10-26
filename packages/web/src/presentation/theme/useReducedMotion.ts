import { REDUCED_MOTION_QUERY } from './themePreference.js';
import { useMediaQuery } from './mediaQuery.js';

/** True when the OS asks for reduced motion; animations should then jump to their final state. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
