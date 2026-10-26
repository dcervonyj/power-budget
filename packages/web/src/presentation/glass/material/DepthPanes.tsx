import React from 'react';
import { useReducedMotion } from '../../theme/useReducedMotion.js';
import { loopStyle } from './motion.js';

export interface DepthPanesProps {
  readonly radius?: string;
  readonly style?: React.CSSProperties;
  readonly children: React.ReactNode;
}

interface PaneSpec {
  readonly transform: string;
  readonly delay: string;
}

const PANES: readonly PaneSpec[] = [
  { transform: 'translate(18px, -14px) rotate(2.5deg)', delay: '0s' },
  { transform: 'translate(-14px, 12px) rotate(-1.5deg)', delay: '-20s' },
];

const FILL: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

/** Two offset clear panes peeking out behind its children (the hero stack). Panes are decorative. */
export function DepthPanes({
  radius = 'var(--pb-glass-radius-panel)',
  style,
  children,
}: DepthPanesProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  return (
    <div style={{ position: 'relative', ...style }}>
      {PANES.map((pane) => (
        <span
          key={pane.transform}
          aria-hidden="true"
          data-glass-decor="depth-pane"
          style={{
            ...FILL,
            ...loopStyle(
              `d7-float 40s ease-in-out ${pane.delay} infinite alternate`,
              reducedMotion,
            ),
          }}
        >
          <span
            style={{
              ...FILL,
              borderRadius: radius,
              background: 'var(--pb-glass-clear)',
              boxShadow: 'var(--pb-glass-clear-rim)',
              transform: pane.transform,
            }}
          />
        </span>
      ))}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
