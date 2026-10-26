import React from 'react';
import { useReducedMotion } from '../../theme/useReducedMotion.js';
import { loopStyle, riseStyle } from './motion.js';

export type GlassMaterial = 'frosted' | 'clear' | 'tinted';
export type GlassDepth = 0 | 1 | 2;

/**
 * Slot of a glint sweep on the screen: 0, 4 s or 8 s stagger (D7 R2.3). Only three slots exist,
 * so a screen can never have more than three sweeping panels as long as each slot is used once.
 */
export type SweepSlot = 0 | 1 | 2;

export interface GlassDecor {
  readonly specular?: boolean;
  readonly film?: boolean;
  readonly sweep?: SweepSlot;
}

export interface GlassPanelProps {
  readonly material?: GlassMaterial;
  readonly depth?: GlassDepth;
  readonly decor?: GlassDecor;
  /** Entrance index: the panel rises with a stagger of `index` steps. Omit for no entrance. */
  readonly rise?: number;
  readonly radius?: string;
  readonly style?: React.CSSProperties;
  /** Style of the content layer, which sits above the decor. */
  readonly contentStyle?: React.CSSProperties;
  readonly children?: React.ReactNode;
}

const DECOR_BASE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  pointerEvents: 'none',
};

const BLUR = 'blur(var(--pb-glass-blur-web)) saturate(150%)';
const SWEEP_DELAYS = ['0s', '4s', '8s'] as const;

export function GlassPanel({
  material = 'frosted',
  depth = 1,
  decor = {},
  rise,
  radius = 'var(--pb-glass-radius-panel)',
  style,
  contentStyle,
  children,
}: GlassPanelProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const rootStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: radius,
    ...materialStyle(material, depth),
    ...(rise === undefined ? {} : riseStyle(rise, reducedMotion)),
    ...style,
  };

  return (
    <div data-glass-material={material} data-glass-depth={depth} style={rootStyle}>
      {decor.specular === true ? <Specular /> : null}
      {decor.film === true ? <Film reducedMotion={reducedMotion} /> : null}
      {decor.sweep === undefined ? null : (
        <Sweep slot={decor.sweep} reducedMotion={reducedMotion} />
      )}
      <div style={{ position: 'relative', ...contentStyle }}>{children}</div>
    </div>
  );
}

function materialStyle(material: GlassMaterial, depth: GlassDepth): React.CSSProperties {
  const hero = depth === 0 ? ', 0 0 0 1px var(--pb-glass-accent-edge)' : '';
  if (material === 'clear') {
    return {
      background: 'var(--pb-glass-clear)',
      boxShadow: `var(--pb-glass-clear-rim)${hero}`,
    };
  }
  if (material === 'tinted') {
    return {
      background: 'var(--pb-glass-tint)',
      backdropFilter: BLUR,
      WebkitBackdropFilter: BLUR,
      boxShadow: `var(--pb-glass-tint-rim)${hero}`,
    };
  }

  const shadow = depth === 0 ? 'var(--pb-glass-shadow-f)' : 'var(--pb-glass-shadow)';

  return {
    background: `var(--pb-glass-g${depth})`,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    boxShadow: `inset 0 0 0 1px var(--pb-glass-edge), inset 0 1px 0 var(--pb-glass-hl), ${shadow}${hero}`,
  };
}

function Specular(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-glass-decor="specular"
      style={{ ...DECOR_BASE, background: 'var(--pb-glass-specular)' }}
    />
  );
}

function Film({ reducedMotion }: { reducedMotion: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-glass-decor="film"
      style={{
        ...DECOR_BASE,
        padding: 1,
        background: 'var(--pb-glass-irid)',
        backgroundSize: '300% 300%',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        ...loopStyle(
          'd7-film var(--pb-glass-motion-film-duration-ms) var(--pb-glass-motion-film-easing) infinite alternate',
          reducedMotion,
        ),
      }}
    />
  );
}

function Sweep({
  slot,
  reducedMotion,
}: {
  slot: SweepSlot;
  reducedMotion: boolean;
}): React.JSX.Element {
  const delay = `calc(var(--pb-glass-motion-sweep-delay-ms) + ${SWEEP_DELAYS[slot]})`;

  return (
    <span aria-hidden="true" data-glass-decor="sweep" style={{ ...DECOR_BASE, overflow: 'hidden' }}>
      <span
        style={{
          position: 'absolute',
          top: '-30%',
          bottom: '-30%',
          left: 0,
          width: '22%',
          background: 'linear-gradient(90deg, transparent, var(--pb-glass-sweep), transparent)',
          transform: 'translateX(-140%) skewX(-16deg)',
          ...loopStyle(
            `d7-sweep var(--pb-glass-motion-sweep-duration-ms) var(--pb-glass-motion-sweep-easing) ${delay} infinite`,
            reducedMotion,
          ),
        }}
      />
    </span>
  );
}
