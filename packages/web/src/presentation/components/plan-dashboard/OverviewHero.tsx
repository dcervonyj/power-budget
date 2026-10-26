import React from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import type {
  CurrentTiming,
  DashboardOverview,
} from '../../../application/dashboard/dashboardOverview.js';
import type { MoneyAmount, PlanDashboard } from '../../../domain/dashboard/PlanDashboard.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { Lens } from '../../glass/light/Lens.js';
import { useLightLabels } from '../../glass/light/useLightLabels.js';
import { DepthPanes } from '../../glass/material/DepthPanes.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { formatAmount, formatSignedAmount } from '../../i18n/formatAmount.js';
import { toSupportedLocale } from '../../i18n/supportedLocale.js';
import {
  BODY_TEXT_STYLE,
  CLEAR_CARD_STYLE,
  DIM_TEXT_STYLE,
  PANEL_LABEL_STYLE,
  PANEL_PADDING,
} from './overviewStyles.js';
import { PacePanel } from './PacePanel.js';
import { currencySymbol, formatWholeAmount } from './wholeAmount.js';
import { formatDayMonth } from './overviewDates.js';

export interface OverviewHeroProps {
  readonly dashboard: PlanDashboard;
  readonly overview: DashboardOverview;
}

const HERO_TITLE_ID = 'overview-hero-title';

const TILE_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 10,
};

/**
 * The hero row: safe to spend today in the lens (current period with a plan), what is left, the
 * stat tiles, and the Pace panel beside it. Past and future plans show no lens and no pace (Q4).
 */
export function OverviewHero({ dashboard, overview }: OverviewHeroProps): React.JSX.Element {
  const current = overview.timing.kind === 'current' && overview.hasPlan ? overview.timing : null;

  return (
    <section
      aria-labelledby={HERO_TITLE_ID}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 16 }}
    >
      <DepthPanes style={{ flex: '999 1 600px', minWidth: 0, display: 'grid' }}>
        <GlassPanel
          material="frosted"
          depth={0}
          decor={{ specular: true, film: true, sweep: 0 }}
          rise={1}
          style={{ height: '100%', boxSizing: 'border-box' }}
          contentStyle={{ padding: PANEL_PADDING }}
        >
          <h2 id={HERO_TITLE_ID} style={PANEL_LABEL_STYLE}>
            {current === null ? (
              <FormattedMessage id="overview.hero.leftTitle" defaultMessage="Left in the plan" />
            ) : (
              <FormattedMessage id="overview.hero.title" defaultMessage="Safe to spend today" />
            )}
          </h2>
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '28px 36px',
            }}
          >
            {current === null ? null : <SafeToSpendLens overview={overview} timing={current} />}
            <div
              style={{
                flex: '1 1 300px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <LeftFigure dashboard={dashboard} overview={overview} current={current} />
              <StatTiles dashboard={dashboard} overview={overview} current={current} />
            </div>
          </div>
        </GlassPanel>
      </DepthPanes>
      {current === null ? null : (
        <PacePanel dashboard={dashboard} overview={overview} timing={current} />
      )}
    </section>
  );
}

function SafeToSpendLens({
  overview,
  timing,
}: {
  overview: DashboardOverview;
  timing: CurrentTiming;
}): React.JSX.Element {
  const intl = useIntl();
  const labels = useLightLabels();
  const locale = toSupportedLocale(intl.locale);
  const { perDay, daysLeft, isOver } = timing.safeToSpend;

  return (
    <div
      style={{
        flex: 'none',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Lens
        lens={{
          fraction: isOver ? 0 : overview.leftFraction,
          amountLabel: formatWholeAmount(perDay, locale, false),
          caption: labels.daysLeft(daysLeft),
          ariaLabel: labels.lensAria(perDay, daysLeft),
          size: 'hero',
        }}
        unitLabel={labels.lensUnit(currencySymbol(perDay.currency, locale))}
      />
      {isOver ? (
        <StatusTag
          kind="over"
          label={intl.formatMessage({ id: 'overview.hero.overTag', defaultMessage: 'Over plan' })}
        />
      ) : null}
    </div>
  );
}

function LeftFigure({
  dashboard,
  overview,
  current,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
  current: CurrentTiming | null;
}): React.JSX.Element {
  return (
    <div>
      {current === null ? null : (
        <p style={{ ...DIM_TEXT_STYLE, fontSize: 'var(--pb-glass-type-body-web)' }}>
          <FormattedMessage id="overview.hero.leftLabel" defaultMessage="Left in the plan" />
        </p>
      )}
      <p
        data-testid="overview-left"
        style={{ margin: '2px 0 0', lineHeight: 1.05, color: 'var(--pb-glass-fg)' }}
      >
        <AmountText amount={overview.left} size="figure" />
      </p>
      <p style={{ ...BODY_TEXT_STYLE, marginTop: 10, maxWidth: '46ch' }}>
        <HeroExplanation dashboard={dashboard} overview={overview} current={current} />
      </p>
    </div>
  );
}

function HeroExplanation({
  dashboard,
  overview,
  current,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
  current: CurrentTiming | null;
}): React.JSX.Element {
  const intl = useIntl();
  const end = formatDayMonth(dashboard.periodEnd, intl);
  if (overview.timing.kind === 'future') {
    return (
      <FormattedMessage
        id="overview.hero.future"
        defaultMessage="This plan starts on {date}. Safe to spend and pace appear once it runs."
        values={{ date: formatDayMonth(dashboard.periodStart, intl) }}
      />
    );
  }
  if (overview.timing.kind === 'past') {
    return (
      <FormattedMessage
        id="overview.hero.past"
        defaultMessage="This plan ended on {date}."
        values={{ date: end }}
      />
    );
  }
  if (current === null) {
    return (
      <FormattedMessage
        id="overview.hero.noPlan"
        defaultMessage="This plan has no planned expenses, so there is no daily amount to show."
      />
    );
  }
  if (current.safeToSpend.isOver) {
    return (
      <FormattedMessage
        id="overview.hero.overExplanation"
        defaultMessage="Spending is past the plan by {amount}, so nothing is left to spend a day until {date}."
        values={{ amount: formatAmount(negate(overview.left), intl.locale), date: end }}
      />
    );
  }

  return (
    <FormattedMessage
      id="overview.hero.spread"
      defaultMessage="Spread over the {days, plural, one {# day} other {# days}} to {date}, that is {amount} a day. The light in the lens is what is still in the plan; it dims and shrinks as you spend."
      values={{
        days: current.safeToSpend.daysLeft,
        date: end,
        amount: formatAmount(current.safeToSpend.perDay, intl.locale),
      }}
    />
  );
}

function StatTiles({
  dashboard,
  overview,
  current,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
  current: CurrentTiming | null;
}): React.JSX.Element {
  const intl = useIntl();
  const { totals } = dashboard;

  return (
    <ul style={{ ...TILE_GRID_STYLE, listStyle: 'none', margin: 0, padding: 0 }}>
      <StatTile
        label={<FormattedMessage id="overview.tile.spent" defaultMessage="Spent so far" />}
        value={<AmountText amount={overview.spent} />}
        sub={
          <FormattedMessage
            id="planDashboard.summary.ofPlanned"
            defaultMessage="of {amount} planned"
            values={{ amount: formatAmount(overview.planned, intl.locale) }}
          />
        }
      />
      <StatTile
        label={
          <FormattedMessage id="planDashboard.summary.income" defaultMessage="Income received" />
        }
        value={<AmountText amount={totals.actualIncome} />}
        sub={
          <FormattedMessage
            id="planDashboard.summary.ofPlanned"
            defaultMessage="of {amount} planned"
            values={{ amount: formatAmount(totals.plannedIncome, intl.locale) }}
          />
        }
      />
      <StatTile
        label={<FormattedMessage id="planDashboard.summary.net" defaultMessage="Net result" />}
        value={formatSignedAmount(totals.net, intl.locale)}
        sub={
          <FormattedMessage
            id="planDashboard.summary.netIncludesUnplanned"
            defaultMessage="Includes unplanned: {spent} spent, {received} received"
            values={{
              spent: formatAmount(totals.unplannedExpenses, intl.locale),
              received: formatAmount(totals.unplannedIncome, intl.locale),
            }}
          />
        }
      />
      {current === null ? null : <ForecastTile timing={current} intl={intl} />}
    </ul>
  );
}

function ForecastTile({
  timing,
  intl,
}: {
  timing: CurrentTiming;
  intl: IntlShape;
}): React.JSX.Element {
  const locale = toSupportedLocale(intl.locale);
  const { total, versusPlan } = timing.forecast;
  const difference = formatWholeAmount(abs(versusPlan), locale, true);

  return (
    <StatTile
      label={<FormattedMessage id="overview.tile.forecast" defaultMessage="Month-end forecast" />}
      value={
        <FormattedMessage
          id="overview.tile.forecastValue"
          defaultMessage="≈ {amount}"
          values={{ amount: formatWholeAmount(total, locale, true) }}
        />
      }
      sub={
        versusPlan.amountMinor >= 0n ? (
          <FormattedMessage
            id="overview.tile.forecastUnder"
            defaultMessage="≈ {amount} under plan, at this pace"
            values={{ amount: difference }}
          />
        ) : (
          <FormattedMessage
            id="overview.tile.forecastOver"
            defaultMessage="≈ {amount} over plan, at this pace"
            values={{ amount: difference }}
          />
        )
      }
    />
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub: React.ReactNode;
}): React.JSX.Element {
  return (
    <li style={{ ...CLEAR_CARD_STYLE, padding: '14px 16px', minWidth: 0 }}>
      <p style={DIM_TEXT_STYLE}>{label}</p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 'var(--pb-glass-type-amount-web)',
          lineHeight: 1.15,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </p>
      <p style={{ ...DIM_TEXT_STYLE, marginTop: 2, color: 'var(--pb-glass-faint)' }}>{sub}</p>
    </li>
  );
}

function negate(money: MoneyAmount): MoneyAmount {
  return { amountMinor: -money.amountMinor, currency: money.currency };
}

function abs(money: MoneyAmount): MoneyAmount {
  return money.amountMinor < 0n ? negate(money) : money;
}
