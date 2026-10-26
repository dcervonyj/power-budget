import React from 'react';
import '../../glass/overlays/overlays.css';

export interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  /** Corner radius in px; defaults to the chip radius token. */
  borderRadius?: number;
}

/** Glass placeholder with a soft shimmer; static under reduced motion. */
export function SkeletonBlock({
  width = '100%',
  height = 20,
  borderRadius,
}: SkeletonBlockProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pbg-skeleton"
      style={{
        width,
        height,
        borderRadius: borderRadius ?? 'var(--pb-glass-radius-tag)',
        boxShadow: 'var(--pb-glass-clear-rim)',
      }}
    />
  );
}
