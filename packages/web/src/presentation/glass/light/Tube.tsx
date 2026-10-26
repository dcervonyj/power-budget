import React from 'react';
import { rodBeam, type TubeProps } from '@power-budget/shared-app';
import { useReducedMotion } from '../../theme/index.js';
import { beamAnimations } from './lightMotion.js';

const TUBE_WIDTH = 18;

export interface TubeComponentProps extends TubeProps {
  readonly height?: number;
  readonly index?: number;
}

/** Vertical glass tube (savings goal, what-if): the light rises from the bottom by `fraction`. */
export function Tube({ tube, height = 160, index = 0 }: TubeComponentProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const beam = rodBeam(tube.fraction);
  const delay = `${index * 80}ms`;
  const loopDelay = `${(index * 370) % 2000}ms`;
  const animations = beamAnimations(reducedMotion, true, delay, loopDelay);

  return (
    <span
      role="img"
      aria-label={tube.ariaLabel}
      data-testid="tube-track"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: TUBE_WIDTH,
        height,
        borderRadius: TUBE_WIDTH / 2,
        background: 'var(--pb-glass-tube)',
        boxShadow: 'var(--pb-glass-tube-rim)',
      }}
    >
      <span style={{ position: 'absolute', left: 2, right: 2, top: 2, bottom: 2 }}>
        {beam.hasSpark ? (
          <span
            data-testid="tube-beam"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: beam.width,
              borderRadius: 4,
              background: 'var(--pb-glass-beam-v)',
              boxShadow: 'var(--pb-glass-bloom)',
              animation: animations.beam,
            }}
          >
            {reducedMotion ? null : (
              <span
                data-testid="tube-spark"
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 0,
                  width: 8,
                  height: 8,
                  margin: '0 0 -4px -4px',
                  borderRadius: '50%',
                  background: 'var(--pb-glass-spark)',
                  animation: animations.spark,
                }}
              />
            )}
          </span>
        ) : null}
      </span>
    </span>
  );
}
