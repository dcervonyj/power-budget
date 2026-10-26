import React from 'react';

interface Swatch {
  readonly name: string;
  readonly variable: string;
}

interface TypeStep {
  readonly name: string;
  readonly size: string;
  readonly weight: string;
}

const SWATCHES: readonly Swatch[] = [
  { name: 'base', variable: '--pb-glass-base' },
  { name: 'fg', variable: '--pb-glass-fg' },
  { name: 'dim', variable: '--pb-glass-dim' },
  { name: 'faint', variable: '--pb-glass-faint' },
  { name: 'g0', variable: '--pb-glass-g0' },
  { name: 'g1', variable: '--pb-glass-g1' },
  { name: 'g2', variable: '--pb-glass-g2' },
  { name: 'edge', variable: '--pb-glass-edge' },
  { name: 'accent', variable: '--pb-glass-accent' },
  { name: 'accentInk', variable: '--pb-glass-accent-ink' },
  { name: 'lightSolid', variable: '--pb-glass-light-solid' },
  { name: 'ok', variable: '--pb-glass-ok' },
  { name: 'over', variable: '--pb-glass-over' },
];

const TYPE_SCALE: readonly TypeStep[] = [
  {
    name: 'display',
    size: '--pb-glass-type-display-web',
    weight: '--pb-glass-type-display-weight',
  },
  { name: 'hero', size: '--pb-glass-type-hero-web', weight: '--pb-glass-type-hero-weight' },
  { name: 'figure', size: '--pb-glass-type-figure-web', weight: '--pb-glass-type-figure-weight' },
  { name: 'title', size: '--pb-glass-type-title-web', weight: '' },
  { name: 'amount', size: '--pb-glass-type-amount-web', weight: '' },
  { name: 'heading', size: '--pb-glass-type-heading-web', weight: '' },
  { name: 'panel-label', size: '--pb-glass-type-panel-label-web', weight: '' },
  { name: 'label', size: '--pb-glass-type-label-web', weight: '--pb-glass-type-label-weight' },
  { name: 'body', size: '--pb-glass-type-body-web', weight: '' },
  { name: 'small', size: '--pb-glass-type-small-web', weight: '' },
  { name: 'tag', size: '--pb-glass-type-tag-web', weight: '--pb-glass-type-tag-weight' },
];

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 'var(--pb-glass-space-md)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

/** Colour tokens of the active theme. */
export function Swatches(): React.JSX.Element {
  return (
    <section aria-label="Token swatches">
      <h2 style={{ fontWeight: 600 }}>Token swatches</h2>
      <ul style={GRID_STYLE}>
        {SWATCHES.map((swatch) => (
          <li key={swatch.name}>
            <div
              style={{
                height: 64,
                borderRadius: 'var(--pb-glass-radius-control)',
                background: `var(${swatch.variable})`,
                boxShadow: 'inset 0 0 0 1px var(--pb-glass-sep)',
              }}
            />
            <div style={LABEL_STYLE}>{swatch.name}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The D7 type scale at web sizes. */
export function TypeScale(): React.JSX.Element {
  return (
    <section aria-label="Type scale">
      <h2 style={{ fontWeight: 600 }}>Type scale</h2>
      {TYPE_SCALE.map((step) => (
        <div key={step.name} style={{ marginBottom: 'var(--pb-glass-space-sm)' }}>
          <div
            style={{
              fontSize: `var(${step.size})`,
              fontWeight: step.weight === '' ? 400 : `var(${step.weight})`,
              lineHeight: 1.1,
            }}
          >
            {step.name}
          </div>
        </div>
      ))}
    </section>
  );
}
