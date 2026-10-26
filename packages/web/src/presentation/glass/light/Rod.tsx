import React from 'react';
import { paceMark, rodBeam, stagger, type RodProps } from '@power-budget/shared-app';
import { useReducedMotion } from '../../theme/index.js';
import { beamAnimations } from './lightMotion.js';
import { useLightLabels } from './useLightLabels.js';

const ROD_HEIGHTS: Record<RodProps['rod']['size'], number> = { pace: 16, category: 10 };

export interface RodComponentProps extends RodProps {
  /** Position in a list; staggers the entrance and desynchronises the loops. */
  readonly index?: number;
  /** Text of the over / paid tag; defaults to the translated "Over budget" / "Paid". */
  readonly tagLabel?: string;
}

/**
 * Horizontal glass rod. The light's length is the money left (fraction); the mark is the part of
 * the month still to come. Over budget shows a hatch and a tag, paid shows a tag, no light either way.
 */
export function Rod({ rod, index = 0, tagLabel }: RodComponentProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const labels = useLightLabels();
  const height = ROD_HEIGHTS[rod.size];
  const beam = rodBeam(rod.state === 'under' ? rod.fraction : 0);
  const delays = stagger(index);
  const animations = beamAnimations(reducedMotion, false, delays.delay, delays.flickerDelay);
  const tagKind = rod.state === 'over' || rod.state === 'paid' ? rod.state : undefined;

  return (
    <div
      role="img"
      aria-label={rod.ariaLabel}
      data-state={rod.state}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <span
        aria-hidden="true"
        data-testid="rod-track"
        style={{
          position: 'relative',
          display: 'block',
          height,
          borderRadius: height / 2,
          background: 'var(--pb-glass-tube)',
          boxShadow: 'var(--pb-glass-tube-rim)',
        }}
      >
        {rod.state === 'over' ? (
          <span
            data-testid="rod-hatch"
            style={{
              position: 'absolute',
              inset: 2,
              borderRadius: height / 2 - 2,
              background: 'var(--pb-glass-over-hatch)',
              opacity: 0.5,
            }}
          />
        ) : null}
        <span style={{ position: 'absolute', left: 2, right: 2, top: 2, bottom: 2 }}>
          {beam.hasSpark ? (
            <span
              data-testid="rod-beam"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: beam.width,
                borderRadius: 4,
                background: 'var(--pb-glass-beam-h)',
                boxShadow: 'var(--pb-glass-bloom)',
                animation: animations.beam,
              }}
            >
              {reducedMotion ? null : (
                <span
                  data-testid="rod-spark"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: 8,
                    height: 8,
                    margin: '-4px 0 0 -4px',
                    borderRadius: '50%',
                    background: 'var(--pb-glass-spark)',
                    animation: animations.spark,
                  }}
                />
              )}
            </span>
          ) : null}
        </span>
        {rod.paceProgress === undefined ? null : (
          <span
            data-testid="rod-pace"
            style={{
              position: 'absolute',
              left: paceMark(rod.paceProgress),
              top: -4,
              width: 2,
              height: height + 8,
              marginLeft: -1,
              borderRadius: 1,
              background: 'var(--pb-glass-pace)',
              opacity: 0.9,
            }}
          />
        )}
      </span>
      {tagKind === undefined ? null : (
        <span
          data-testid="rod-tag"
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 'var(--pb-glass-radius-tag)',
            fontSize: 'var(--pb-glass-type-tag-web)',
            fontWeight: 'var(--pb-glass-type-tag-weight)',
            background: tagKind === 'over' ? 'var(--pb-glass-over-tint)' : 'var(--pb-glass-fill2)',
            color: tagKind === 'over' ? 'var(--pb-glass-over)' : 'var(--pb-glass-dim)',
          }}
        >
          {renderTagIcon(tagKind)}
          {tagLabel === undefined ? labels.rodTag(tagKind) : tagLabel}
        </span>
      )}
    </div>
  );
}

function renderTagIcon(kind: 'over' | 'paid'): React.JSX.Element {
  const path =
    kind === 'over' ? 'M12 4 L21 20 H3 Z M12 10 V14 M12 17 V17.2' : 'M5 12.5 L10 17 L19 7';

  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
