import React from 'react';
import { Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { DepthPanes } from '../../../glass/material/DepthPanes.js';
import { Lens } from '../../../glass/light/Lens.js';
import { useLightLabels } from '../../../glass/light/useLightLabels.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import { toSupportedLocale } from '../../../glass/atoms/supportedLocale.js';
import { roundToWholeUnits, type CurrentTiming, type OverviewModel } from './overviewModel.js';
import { currencySymbol, formatWholeAmount } from './overviewFormat.js';
import { useOverviewStyles } from './overviewStyles.js';
import { useOverviewLabels } from './useOverviewLabels.js';

const useStyles = makeStyles((glass) => ({
  content: { padding: glass.space.lg, gap: glass.space.sm, alignItems: 'center' },
  title: { alignSelf: 'flex-start' },
  lens: { marginVertical: glass.space.xs },
  tiles: {
    flexDirection: 'row',
    gap: glass.space.sm,
    alignSelf: 'stretch',
    marginTop: glass.space.xs,
  },
  tile: { flex: 1 },
  tileContent: { padding: glass.space.sm, gap: 2 },
  tileAmount: {
    color: glass.colors.fg,
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.amount.mobile,
    fontVariant: ['tabular-nums'],
  },
}));

export interface OverviewHeroProps {
  readonly model: OverviewModel;
}

/**
 * Hero stack: two clear depth panes behind one frosted panel with the safe-to-spend lens (current
 * period with planned expenses only), what is left of the plan and two clear stat tiles.
 */
export function OverviewHero({ model }: OverviewHeroProps): React.JSX.Element {
  const styles = useStyles();
  const text = useOverviewStyles();
  const labels = useOverviewLabels();

  return (
    <DepthPanes>
      <GlassPanel
        material="frosted"
        depth={0}
        decor={{ specular: true, film: true, sweep: 0 }}
        rise={1}
        contentStyle={styles.content}
      >
        <Text accessibilityRole="header" style={[text.heading, styles.title]}>
          {labels.heroTitle()}
        </Text>
        <HeroBody model={model} />
        <View style={styles.tiles}>
          <StatTile
            title={labels.spentTile()}
            amount={model.spent}
            caption={labels.ofPlanned(model.planned)}
          />
          <StatTile
            title={labels.incomeTile()}
            amount={model.incomeReceived}
            caption={labels.ofPlanned(model.incomePlanned)}
          />
        </View>
      </GlassPanel>
    </DepthPanes>
  );
}

function HeroBody({ model }: { readonly model: OverviewModel }): React.JSX.Element {
  const text = useOverviewStyles();
  const labels = useOverviewLabels();
  const { timing } = model;

  if (!model.hasPlan) {
    return <Text style={[text.body, text.centered]}>{labels.noPlannedExpenses()}</Text>;
  }
  const leftLine = (
    <Text testID="overview-left" style={[text.body, text.centered]}>
      {labels.leftOfPlanned(model.left, model.planned)}
    </Text>
  );
  if (timing.kind !== 'current') {
    return (
      <>
        <Text style={[text.body, text.centered]}>
          {timing.kind === 'future'
            ? labels.future(model.periodStart)
            : labels.past(model.periodEnd)}
        </Text>
        {leftLine}
      </>
    );
  }

  return (
    <>
      <SafeToSpendLens model={model} timing={timing} />
      {timing.safeToSpend.isOver ? (
        <>
          <StatusTag kind="over" label={labels.overTag()} />
          <Text style={[text.body, text.centered]}>
            {labels.overExplanation(negate(model.left), model.periodEnd)}
          </Text>
        </>
      ) : (
        <>
          {leftLine}
          <Text style={[text.small, text.centered]}>{labels.lightHint()}</Text>
        </>
      )}
    </>
  );
}

function SafeToSpendLens({
  model,
  timing,
}: {
  readonly model: OverviewModel;
  readonly timing: CurrentTiming;
}): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const lightLabels = useLightLabels();
  const locale = toSupportedLocale(intl.locale);
  const { perDay, daysLeft } = timing.safeToSpend;

  return (
    <View style={styles.lens}>
      <Lens
        lens={{
          fraction: model.leftFraction,
          amountLabel: formatWholeAmount(perDay, locale, false),
          caption: lightLabels.daysLeft(daysLeft),
          ariaLabel: lightLabels.lensAria(perDay, daysLeft),
          size: 'mobile',
        }}
        unitLabel={lightLabels.lensUnit(currencySymbol(perDay.currency, locale))}
      />
    </View>
  );
}

function StatTile({
  title,
  amount,
  caption,
}: {
  readonly title: string;
  readonly amount: MinorUnitAmount;
  readonly caption: string;
}): React.JSX.Element {
  const styles = useStyles();
  const text = useOverviewStyles();
  const glass = useGlass();
  const labels = useOverviewLabels();

  return (
    <GlassPanel
      material="clear"
      radius={glass.radius.tile}
      style={styles.tile}
      contentStyle={styles.tileContent}
    >
      <Text style={text.small}>{title}</Text>
      <Text style={styles.tileAmount} numberOfLines={1}>
        {labels.wholeAmount({
          amountMinor: roundToWholeUnits(amount.amountMinor, amount.currency),
          currency: amount.currency,
        })}
      </Text>
      <Text style={text.small}>{caption}</Text>
    </GlassPanel>
  );
}

function negate(money: MinorUnitAmount): MinorUnitAmount {
  return { amountMinor: -money.amountMinor, currency: money.currency };
}
