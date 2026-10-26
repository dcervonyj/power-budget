import React from 'react';
import { lensGeometry, type LensProps } from '@power-budget/shared-app';
import { useReducedMotion } from '../../theme/index.js';
import { lensAnimations } from './lightMotion.js';

const REFERENCE_SIZE = 264;
const LENS_SIZES: Record<LensProps['lens']['size'], number> = { hero: 264, mobile: 220, mini: 120 };

interface TwinkleSpot {
  readonly left: string;
  readonly top: string;
  readonly size: number;
}

const TWINKLE_SPOTS: readonly TwinkleSpot[] = [
  { left: '38%', top: '70%', size: 6 },
  { left: '60%', top: '78%', size: 5 },
  { left: '51%', top: '64%', size: 4 },
];

const FILL_LAYER: React.CSSProperties = { position: 'absolute', inset: 0 };
const FILL_PATHS: readonly { readonly d: string; readonly width: string }[] = [
  { d: 'M22 70 C 34 63, 44 76, 56 68 S 74 62, 80 70', width: '.7' },
  { d: 'M28 80 C 40 74, 52 86, 64 78 S 76 76, 78 80', width: '.5' },
  { d: 'M34 60 C 44 56, 54 64, 66 58', width: '.4' },
];

export interface LensComponentProps extends LensProps {
  /** Small line under the number, for example "zł a day". */
  readonly unitLabel?: string;
}

/**
 * Safe-to-spend lens: money left is a glowing core inside glass (D7 R2.4 / R2.8).
 * The number sits in the upper 42 % only; the caption is outside the glass.
 */
export function Lens({ lens, unitLabel }: LensComponentProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const geometry = lensGeometry(lens.fraction);
  const animations = lensAnimations(reducedMotion);
  const diameter = LENS_SIZES[lens.size];
  const scale = diameter / REFERENCE_SIZE;

  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        data-testid="lens-frame"
        style={{ position: 'relative', flex: 'none', width: diameter, height: diameter }}
      >
        <span
          aria-hidden="true"
          data-testid="lens-bloom"
          style={{
            position: 'absolute',
            left: -60 * scale,
            right: -60 * scale,
            top: 20 * scale,
            bottom: -70 * scale,
            borderRadius: '50%',
            opacity: geometry.bloomOpacity,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              ...FILL_LAYER,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, var(--pb-glass-bloom-far), transparent)',
              animation: animations.bloom,
            }}
          />
        </span>
        <div
          role="img"
          aria-label={lens.ariaLabel}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--pb-glass-lens)',
            boxShadow: 'var(--pb-glass-lens-rim)',
          }}
        >
          {geometry.hasCore ? renderLight(geometry.size, geometry.opacity, animations) : null}
          {renderSpecular()}
          {renderFilmRim(animations.film)}
          <div
            data-testid="lens-text"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '11%',
              height: '31%',
              textAlign: 'center',
              color: 'var(--pb-glass-fg)',
            }}
          >
            <div
              style={{
                fontSize: 76 * scale,
                lineHeight: `${66 * scale}px`,
                fontWeight: 300,
                letterSpacing: '-0.04em',
              }}
            >
              {lens.amountLabel}
            </div>
            {unitLabel === undefined ? null : (
              <div
                style={{
                  fontSize: Math.max(10, 16 * scale),
                  lineHeight: `${16 * scale}px`,
                  color: 'var(--pb-glass-dim)',
                }}
              >
                {unitLabel}
              </div>
            )}
          </div>
        </div>
      </div>
      <figcaption
        style={{
          marginTop: 12 * scale,
          fontSize: 'var(--pb-glass-type-body-web)',
          color: 'var(--pb-glass-dim)',
        }}
      >
        {lens.caption}
      </figcaption>
    </figure>
  );
}

function renderLight(
  size: string,
  opacity: string,
  animations: ReturnType<typeof lensAnimations>,
): React.JSX.Element {
  return (
    <>
      <span
        data-testid="lens-core"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: '76%',
          width: size,
          height: size,
          transform: 'translate(-50%, -50%)',
          opacity,
          transition: 'width 420ms, height 420ms, opacity 420ms',
        }}
      >
        <span
          data-testid="lens-core-glow"
          style={{
            ...FILL_LAYER,
            borderRadius: '50%',
            background: 'var(--pb-glass-core)',
            animation: animations.core,
          }}
        />
      </span>
      <svg
        data-testid="lens-caustics"
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        style={{ ...FILL_LAYER, animation: animations.caustic }}
      >
        {FILL_PATHS.map((path) => (
          <path
            key={path.d}
            d={path.d}
            stroke="var(--pb-glass-caustic)"
            strokeWidth={path.width}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {TWINKLE_SPOTS.map((spot, index) => (
        <span
          key={spot.left}
          data-testid="lens-spark"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: spot.left,
            top: spot.top,
            width: spot.size,
            height: spot.size,
            borderRadius: '50%',
            background: 'var(--pb-glass-spark)',
            animation: animations.twinkles[index],
          }}
        />
      ))}
    </>
  );
}

function renderSpecular(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      style={{ ...FILL_LAYER, pointerEvents: 'none' }}
    >
      <path
        d="M14 38 C 16 24, 28 13, 42 10"
        stroke="var(--pb-glass-spec)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M80 86 C 86 78, 90 68, 91 60"
        stroke="var(--pb-glass-spec)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity=".6"
      />
    </svg>
  );
}

function renderFilmRim(animation: string | undefined): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        ...FILL_LAYER,
        borderRadius: '50%',
        padding: 1,
        background: 'var(--pb-glass-irid)',
        backgroundSize: '300% 300%',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
        animation,
      }}
    />
  );
}
