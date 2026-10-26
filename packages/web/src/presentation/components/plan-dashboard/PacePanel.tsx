import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type {
  CurrentTiming,
  DashboardOverview,
} from '../../../application/dashboard/dashboardOverview.js';
import type { PlanDashboard } from '../../../domain/dashboard/PlanDashboard.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { Rod } from '../../glass/light/Rod.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import { toSupportedLocale } from '../../i18n/supportedLocale.js';
import {
  BODY_TEXT_STYLE,
  DIM_TEXT_STYLE,
  LIST_RESET_STYLE,
  PANEL_LABEL_STYLE,
  PANEL_PADDING,
} from './overviewStyles.js';
import { formatWholeAmount } from './wholeAmount.js';

export interface PacePanelProps {
  readonly dashboard: PlanDashboard;
  readonly overview: DashboardOverview;
  readonly timing: CurrentTiming;
}

const BIG_PERCENT_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--pb-glass-type-figure-web)',
  lineHeight: 1,
  fontWeight: 300,
  letterSpacing: '-0.04em',
};

const SWATCH_STYLE: React.CSSProperties = {
  flex: 'none',
  position: 'relative',
  width: 22,
  height: 10,
  borderRadius: 5,
  background: 'var(--pb-glass-tube)',
  boxShadow: 'var(--pb-glass-tube-rim)',
};

/**
 * Pace (tinted glass): the share of the plan still left as light against the share of the month
 * still to come (the mark), the under / over pace words and the forecast sentence.
 */
export function PacePanel({ dashboard, overview, timing }: PacePanelProps): React.JSX.Element {
  const intl = useIntl();
  const { pace } = timing;
  const under = pace.kind === 'under';
  const leftPercent = formatPercent(pace.leftPercent, intl.locale);
  const monthPercent = formatPercent(pace.monthLeftPercent, intl.locale);
  const rodAria = intl.formatMessage(
    under
      ? {
          id: 'overview.pace.aria.under',
          defaultMessage:
            'Pace: {left} of the plan is still left as light, {month} of the month is still to come. The light reaches past the mark, so spending is under pace.',
        }
      : {
          id: 'overview.pace.aria.over',
          defaultMessage:
            'Pace: {left} of the plan is still left as light, {month} of the month is still to come. The light stops before the mark, so spending is over pace.',
        },
    { left: leftPercent, month: monthPercent },
  );

  return (
    <GlassPanel
      material="tinted"
      depth={1}
      decor={{ specular: true, film: true, sweep: 1 }}
      rise={2}
      style={{ flex: '1 1 360px', minWidth: 0 }}
      contentStyle={{ padding: PANEL_PADDING }}
    >
      <section
        aria-labelledby="overview-pace-title"
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h2 id="overview-pace-title" style={PANEL_LABEL_STYLE}>
            <FormattedMessage id="overview.pace.title" defaultMessage="Pace" />
          </h2>
          <StatusTag
            kind={under ? 'ok' : 'over'}
            label={
              under
                ? intl.formatMessage({ id: 'overview.pace.under', defaultMessage: 'Under pace' })
                : intl.formatMessage({ id: 'overview.pace.over', defaultMessage: 'Over pace' })
            }
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 24px' }}>
          <p style={{ margin: 0 }}>
            <span style={BIG_PERCENT_STYLE}>{leftPercent}</span>
            <span style={{ ...DIM_TEXT_STYLE, display: 'block', marginTop: 4 }}>
              <FormattedMessage id="overview.pace.planLeft" defaultMessage="of the plan left" />
            </span>
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ ...BIG_PERCENT_STYLE, color: 'var(--pb-glass-dim)' }}>
              {monthPercent}
            </span>
            <span style={{ ...DIM_TEXT_STYLE, display: 'block', marginTop: 4 }}>
              <FormattedMessage id="overview.pace.monthLeft" defaultMessage="of the month left" />
            </span>
          </p>
        </div>
        <div>
          <Rod
            rod={{
              fraction: overview.left.amountMinor > 0n ? overview.leftFraction : 0,
              paceProgress: pace.elapsedFraction,
              state: overview.left.amountMinor > 0n ? 'under' : 'over',
              ariaLabel: rodAria,
              size: 'pace',
            }}
          />
          <RodScale
            dashboard={dashboard}
            overview={overview}
            monthLeftPercent={pace.monthLeftPercent}
          />
        </div>
        <Legend overview={overview} monthPercent={monthPercent} />
        <p style={BODY_TEXT_STYLE}>
          <PaceSummary dashboard={dashboard} timing={timing} />
        </p>
      </section>
    </GlassPanel>
  );
}

function RodScale({
  dashboard,
  overview,
  monthLeftPercent,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
  monthLeftPercent: number;
}): React.JSX.Element {
  const intl = useIntl();
  const locale = toSupportedLocale(intl.locale);
  const zero = { amountMinor: 0n, currency: dashboard.baseCurrency };

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        height: 22,
        marginTop: 10,
        fontSize: 'var(--pb-glass-type-tag-web)',
        color: 'var(--pb-glass-dim)',
      }}
    >
      <span style={{ position: 'absolute', left: 0 }}>{formatWholeAmount(zero, locale, true)}</span>
      <span
        style={{
          position: 'absolute',
          left: `${String(monthLeftPercent)}%`,
          transform: 'translateX(-50%)',
          color: 'var(--pb-glass-fg)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <FormattedMessage id="overview.pace.markLabel" defaultMessage="Month left" />
      </span>
      <span style={{ position: 'absolute', right: 0 }}>
        {formatWholeAmount(overview.planned, locale, true)}
      </span>
    </div>
  );
}

function Legend({
  overview,
  monthPercent,
}: {
  overview: DashboardOverview;
  monthPercent: string;
}): React.JSX.Element {
  const intl = useIntl();
  const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };

  return (
    <ul
      style={{
        ...LIST_RESET_STYLE,
        ...DIM_TEXT_STYLE,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <li style={itemStyle}>
        <span aria-hidden="true" style={SWATCH_STYLE}>
          <span
            style={{
              position: 'absolute',
              inset: 2,
              borderRadius: 3,
              background: 'var(--pb-glass-beam-h)',
            }}
          />
        </span>
        <FormattedMessage
          id="overview.pace.legendLight"
          defaultMessage="Light = money left, {amount}"
          values={{
            amount: formatAmount(
              overview.left.amountMinor > 0n
                ? overview.left
                : { amountMinor: 0n, currency: overview.left.currency },
              intl.locale,
            ),
          }}
        />
      </li>
      <li style={itemStyle}>
        <span aria-hidden="true" style={SWATCH_STYLE} />
        <FormattedMessage
          id="overview.pace.legendSpent"
          defaultMessage="Empty glass = spent, {amount}"
          values={{ amount: formatAmount(overview.spent, intl.locale) }}
        />
      </li>
      <li style={itemStyle}>
        <span
          aria-hidden="true"
          style={{ flex: 'none', width: 22, display: 'inline-flex', justifyContent: 'center' }}
        >
          <span
            style={{
              width: 2,
              height: 16,
              borderRadius: 1,
              background: 'var(--pb-glass-pace)',
              opacity: 0.9,
            }}
          />
        </span>
        <FormattedMessage
          id="overview.pace.legendMark"
          defaultMessage="Mark = month left ({percent})"
          values={{ percent: monthPercent }}
        />
      </li>
    </ul>
  );
}

function PaceSummary({
  dashboard,
  timing,
}: {
  dashboard: PlanDashboard;
  timing: CurrentTiming;
}): React.JSX.Element {
  const intl = useIntl();
  const locale = toSupportedLocale(intl.locale);
  const { pace, forecast, safeToSpend } = timing;
  const points = Math.abs(pace.leftPercent - pace.monthLeftPercent);
  const difference = formatWholeAmount(
    {
      amountMinor:
        forecast.versusPlan.amountMinor < 0n
          ? -forecast.versusPlan.amountMinor
          : forecast.versusPlan.amountMinor,
      currency: forecast.versusPlan.currency,
    },
    locale,
    true,
  );
  const values = {
    points,
    plan: dashboard.planName,
    perDay: formatAmount(safeToSpend.perDay, intl.locale),
    amount: difference,
  };
  if (pace.kind === 'under') {
    return (
      <FormattedMessage
        id="overview.pace.summaryUnder"
        defaultMessage="Spending is {points, plural, one {# point} other {# points}} behind the calendar. Keep it near {perDay} a day and {plan} closes about {amount} under plan."
        values={values}
      />
    );
  }
  if (forecast.versusPlan.amountMinor < 0n) {
    return (
      <FormattedMessage
        id="overview.pace.summaryOver"
        defaultMessage="Spending is {points, plural, one {# point} other {# points}} ahead of the calendar. At this pace {plan} closes about {amount} over plan."
        values={values}
      />
    );
  }

  return (
    <FormattedMessage
      id="overview.pace.summaryOverStillUnder"
      defaultMessage="Spending is {points, plural, one {# point} other {# points}} ahead of the calendar. At this pace {plan} still closes about {amount} under plan."
      values={values}
    />
  );
}

function formatPercent(percent: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / 100,
  );
}
