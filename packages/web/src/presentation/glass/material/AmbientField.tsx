import React from 'react';
import { useReducedMotion } from '../../theme/useReducedMotion.js';
import { loopStyle } from './motion.js';

export interface AmbientFieldProps {
  /** `fixed` covers the viewport (screens); `absolute` fills the nearest positioned ancestor. */
  readonly position?: 'fixed' | 'absolute';
  /** Honey glow under the hero; its slot is where the hero sits. */
  readonly glow?: boolean;
  readonly glowPosition?: { readonly top: string; readonly left: string };
}

interface BlobSpec {
  readonly color: string;
  readonly size: number;
  readonly top: string;
  readonly left: string;
  readonly drift: string;
  readonly durationVar: string;
}

const BLOBS: readonly BlobSpec[] = [
  {
    color: 'var(--pb-glass-b1)',
    size: 760,
    top: '-18%',
    left: '-10%',
    drift: 'd7-drift1',
    durationVar: 'var(--pb-glass-motion-ambient-drift-0)',
  },
  {
    color: 'var(--pb-glass-b2)',
    size: 680,
    top: '30%',
    left: '62%',
    drift: 'd7-drift2',
    durationVar: 'var(--pb-glass-motion-ambient-drift-1)',
  },
  {
    color: 'var(--pb-glass-b3)',
    size: 620,
    top: '66%',
    left: '14%',
    drift: 'd7-drift3',
    durationVar: 'var(--pb-glass-motion-ambient-drift-2)',
  },
];

const BEAMS: readonly React.CSSProperties[] = [
  { left: '22%', transform: 'rotate(24deg)' },
  { left: '68%', transform: 'rotate(24deg)' },
];

const FAR_SLABS: readonly React.CSSProperties[] = [
  { top: '12%', left: '70%', width: 360, height: 220, transform: 'rotate(-8deg)' },
  { top: '70%', left: '4%', width: 300, height: 190, transform: 'rotate(6deg)' },
];

const FILL: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };

export function AmbientField({
  position = 'fixed',
  glow = true,
  glowPosition = { top: '14%', left: '38%' },
}: AmbientFieldProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      data-glass-ambient=""
      style={{
        position,
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'var(--pb-glass-base)',
      }}
    >
      {BLOBS.map((blob) => (
        <span
          key={blob.drift}
          data-ambient="blob"
          style={{
            ...FILL,
            top: blob.top,
            left: blob.left,
            width: blob.size,
            height: blob.size,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${blob.color}, transparent)`,
            ...loopStyle(
              `${blob.drift} ${blob.durationVar} ease-in-out infinite alternate`,
              reducedMotion,
            ),
          }}
        />
      ))}
      {glow ? (
        <span
          data-ambient="glow"
          style={{
            ...FILL,
            ...glowPosition,
            width: 560,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, var(--pb-glass-glow), transparent)',
            ...loopStyle('d7-breathe 6s ease-in-out infinite alternate', reducedMotion),
          }}
        />
      ) : null}
      {BEAMS.map((beam) => (
        <span
          key={beam.left}
          data-ambient="beam"
          style={{
            ...FILL,
            top: '-20%',
            bottom: '-20%',
            width: 120,
            background: 'linear-gradient(90deg, transparent, var(--pb-glass-beam), transparent)',
            ...beam,
          }}
        />
      ))}
      {FAR_SLABS.map((slab) => (
        <span
          key={slab.top}
          data-ambient="far-slab"
          style={{
            ...FILL,
            borderRadius: 'var(--pb-glass-radius-panel)',
            background: 'var(--pb-glass-far)',
            boxShadow: 'inset 0 0 0 1px var(--pb-glass-far-edge)',
            ...slab,
          }}
        />
      ))}
    </div>
  );
}
