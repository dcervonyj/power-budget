import React from 'react';
import type { LensData, RodData } from '@power-budget/shared-app';
import { Lens } from './Lens.js';
import { Rod } from './Rod.js';
import { useLightLabels } from './useLightLabels.js';

const PLAN = { amountMinor: 1180000n, currency: 'PLN' };
const PER_DAY = { amountMinor: 47700n, currency: 'PLN' };
const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-3xl)',
  alignItems: 'flex-start',
};
const ROD_COLUMN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xl)',
  width: 360,
  maxWidth: '100%',
};

function lensData(fraction: number, size: LensData['size'], ariaLabel: string): LensData {
  return { fraction, amountLabel: '477', caption: '10 days left', ariaLabel, size };
}

function LensFixture({ fraction, size }: { fraction: number; size: LensData['size'] }) {
  const labels = useLightLabels();

  return (
    <Lens
      lens={lensData(fraction, size, labels.lensAria(PER_DAY, 10))}
      unitLabel={labels.lensUnit('zł')}
    />
  );
}

/** Safe to spend, f = 40.4 %, web size 264. */
export function LensUnder(): React.JSX.Element {
  return <LensFixture fraction={4770 / 11800} size="hero" />;
}

/** Nothing left: no core, caustics or sparks. */
export function LensEmpty(): React.JSX.Element {
  return <LensFixture fraction={0} size="hero" />;
}

/** Everything left: the core at full intensity. */
export function LensFull(): React.JSX.Element {
  return <LensFixture fraction={1} size="hero" />;
}

/** Mobile (220) and Add-screen mini (120) sizes. */
export function LensSizes(): React.JSX.Element {
  return (
    <div style={WRAP_STYLE}>
      <LensFixture fraction={4770 / 11800} size="mobile" />
      <LensFixture fraction={4770 / 11800} size="mini" />
    </div>
  );
}

function rodData(
  state: RodData['state'],
  fraction: number,
  size: RodData['size'],
  ariaLabel: string,
): RodData {
  return { fraction, state, size, ariaLabel, paceProgress: size === 'pace' ? 0.71 : undefined };
}

function RodRows({ size }: { size: RodData['size'] }): React.JSX.Element {
  const labels = useLightLabels();
  const left = { amountMinor: 105136n, currency: 'PLN' };
  const over = { amountMinor: 6250n, currency: 'PLN' };

  return (
    <div style={ROD_COLUMN_STYLE}>
      <Rod
        index={0}
        rod={rodData('under', 0.48, size, labels.rodAria('Groceries', 'under', left, PLAN))}
      />
      <Rod
        index={1}
        rod={rodData('under', 0.05, size, labels.rodAria('Transport', 'under', left, PLAN))}
      />
      <Rod
        index={2}
        rod={rodData('over', 0, size, labels.rodAria('Eating out', 'over', over, PLAN))}
        tagLabel="Over by 62,50 zł"
      />
      <Rod index={3} rod={rodData('paid', 0, size, labels.rodAria('Rent', 'paid', left, PLAN))} />
      <Rod index={4} rod={rodData('empty', 0, size, labels.rodAria('Home', 'empty', left, PLAN))} />
    </div>
  );
}

/** PaceRod (16 high): under, nearly empty, over, paid and empty, with the month-left mark. */
export function RodPace(): React.JSX.Element {
  return <RodRows size="pace" />;
}

/** Category rod (10 high), same states. */
export function RodCategory(): React.JSX.Element {
  return <RodRows size="category" />;
}
