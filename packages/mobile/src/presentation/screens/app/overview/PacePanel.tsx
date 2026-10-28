import React from 'react';
import { Text, View } from 'react-native';
import type { MinorUnitAmount } from '@power-budget/core';
import { makeStyles } from '../../../theme/index.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { Rod } from '../../../glass/light/Rod.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import type { CurrentTiming, OverviewModel } from './overviewModel.js';
import { useOverviewStyles } from './overviewStyles.js';
import { useOverviewLabels } from './useOverviewLabels.js';

const useStyles = makeStyles((glass) => ({
  figures: { flexDirection: 'row', gap: glass.space.lg },
  figure: { flex: 1, gap: 2 },
  percent: {
    color: glass.colors.fg,
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.amount.mobile,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: glass.space.xs,
    marginTop: glass.space.xs,
  },
}));

export interface PacePanelProps {
  readonly model: OverviewModel;
  readonly timing: CurrentTiming;
}

/**
 * Tinted Pace panel: under / over pace in words, the share of the plan spent against the share of
 * the month gone, the pace rod (light = money left, mark = month left) and the "at this pace" line.
 */
export function PacePanel({ model, timing }: PacePanelProps): React.JSX.Element {
  const styles = useStyles();
  const text = useOverviewStyles();
  const labels = useOverviewLabels();
  const { pace, forecast, safeToSpend } = timing;

  return (
    <GlassPanel
      material="tinted"
      decor={{ specular: true, film: true, sweep: 1 }}
      rise={2}
      contentStyle={text.panel}
    >
      <View style={text.headingRow}>
        <Text accessibilityRole="header" style={text.heading}>
          {labels.paceTitle()}
        </Text>
        <StatusTag
          kind={pace.kind === 'under' ? 'ok' : 'over'}
          label={labels.paceKind(pace.kind)}
        />
      </View>
      <View style={styles.figures}>
        <View style={styles.figure}>
          <Text style={styles.percent}>{labels.percent(pace.spentPercent)}</Text>
          <Text style={text.small}>{labels.planSpent()}</Text>
        </View>
        <View style={styles.figure}>
          <Text style={styles.percent}>{labels.percent(pace.elapsedPercent)}</Text>
          <Text style={text.small}>{labels.monthGone()}</Text>
        </View>
      </View>
      <View>
        <Rod
          rod={{
            fraction: model.leftFraction,
            paceProgress: 1 - pace.monthLeftFraction,
            state: model.left.amountMinor > 0n ? 'under' : 'over',
            size: 'pace',
            ariaLabel: labels.paceAria(pace.kind, pace.leftPercent, pace.monthLeftPercent),
          }}
          tagLabel={labels.overTag()}
        />
        <View
          style={styles.legend}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={text.small}>{labels.wholeAmount(zeroOf(model.planned))}</Text>
          <Text style={text.small}>{labels.monthLeftMark(pace.monthLeftPercent)}</Text>
          <Text style={text.small}>{labels.wholeAmount(model.planned)}</Text>
        </View>
      </View>
      <Text style={text.body}>
        {labels.paceSummary({
          kind: pace.kind,
          points: Math.abs(pace.spentPercent - pace.elapsedPercent),
          plan: model.planName,
          perDay: safeToSpend.perDay,
          versusPlan: forecast.versusPlan,
        })}
      </Text>
      <Text testID="overview-forecast" style={[text.body, text.strong]}>
        {labels.forecastLine(forecast.total, model.periodEnd)}
      </Text>
    </GlassPanel>
  );
}

function zeroOf(money: MinorUnitAmount): MinorUnitAmount {
  return { amountMinor: 0n, currency: money.currency };
}
