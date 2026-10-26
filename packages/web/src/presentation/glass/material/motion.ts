import type React from 'react';

/** Panel entrance: `d7-rise` with the token duration/easing and a stagger of one step per index. */
export function riseStyle(index: number, reducedMotion: boolean): React.CSSProperties {
  if (reducedMotion) {
    return {};
  }

  return {
    animation: `d7-rise var(--pb-glass-motion-rise-duration-ms) var(--pb-glass-motion-rise-easing) calc(var(--pb-glass-motion-rise-stagger-ms) * ${Math.max(0, Math.floor(index))}) var(--pb-glass-motion-rise-fill)`,
  };
}

/** Looping decor animation; empty under reduced motion so the static frame is the final state. */
export function loopStyle(animation: string, reducedMotion: boolean): React.CSSProperties {
  return reducedMotion ? {} : { animation };
}
