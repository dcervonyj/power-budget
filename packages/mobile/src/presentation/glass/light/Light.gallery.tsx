import React from 'react';
import { View } from 'react-native';
import type { LensData, RodData } from '@power-budget/shared-app';
import { makeStyles } from '../../theme/index.js';
import { Lens } from './Lens.js';
import { Rod } from './Rod.js';
import { useLightLabels } from './useLightLabels.js';

const PLAN = { amountMinor: 1180000n, currency: 'PLN' };
const PER_DAY = { amountMinor: 47700n, currency: 'PLN' };
const FRACTION = 4770 / 11800;

const useStyles = makeStyles((glass) => ({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: glass.space['3xl'],
    alignItems: 'flex-start',
  },
  center: { alignItems: 'center' },
  rods: { gap: glass.space.xl, paddingTop: glass.space.sm },
}));

function lensData(fraction: number, size: LensData['size'], ariaLabel: string): LensData {
  return { fraction, amountLabel: '477', caption: '10 days left', ariaLabel, size };
}

function LensFixture({
  fraction,
  size,
}: {
  readonly fraction: number;
  readonly size: LensData['size'];
}): React.JSX.Element {
  const labels = useLightLabels();

  return (
    <Lens
      lens={lensData(fraction, size, labels.lensAria(PER_DAY, 10))}
      unitLabel={labels.lensUnit('zł')}
    />
  );
}

/** Safe to spend, f = 40.4 %, mobile size 220. */
export function LensUnder(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.center}>
      <LensFixture fraction={FRACTION} size="mobile" />
    </View>
  );
}

/** Nothing left: no core, caustics or sparks. */
export function LensEmpty(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.center}>
      <LensFixture fraction={0} size="mobile" />
    </View>
  );
}

/** Everything left: the core at full intensity. */
export function LensFull(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.center}>
      <LensFixture fraction={1} size="mobile" />
    </View>
  );
}

/** Add-screen mini lens (120) at two levels. */
export function LensMini(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      <LensFixture fraction={FRACTION} size="mini" />
      <LensFixture fraction={0.1} size="mini" />
    </View>
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

function RodRows({ size }: { readonly size: RodData['size'] }): React.JSX.Element {
  const styles = useStyles();
  const labels = useLightLabels();
  const left = { amountMinor: 105136n, currency: 'PLN' };
  const over = { amountMinor: 6250n, currency: 'PLN' };

  return (
    <View style={styles.rods}>
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
      />
      <Rod index={3} rod={rodData('paid', 0, size, labels.rodAria('Rent', 'paid', left, PLAN))} />
      <Rod index={4} rod={rodData('empty', 0, size, labels.rodAria('Home', 'empty', left, PLAN))} />
    </View>
  );
}

/** PaceRod (14 high): under, nearly empty, over, paid and empty, with the month-left mark. */
export function RodPace(): React.JSX.Element {
  return <RodRows size="pace" />;
}

/** Category rod (10 high), same states. */
export function RodCategory(): React.JSX.Element {
  return <RodRows size="category" />;
}
