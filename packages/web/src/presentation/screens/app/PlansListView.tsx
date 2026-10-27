import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { isPlanArchived } from '@power-budget/shared-app';
import type { PlanDto, PlanPeriodKindDto } from '@power-budget/shared-app/contract';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import '../../glass/controls/controls.css';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { formatIsoDate } from '../../i18n/formatAmount.js';
import { CAPTION_STYLE, GRID_STYLE, HEADER_STYLE, PAGE_STYLE, TITLE_STYLE } from './planStyles.js';

export interface PlansListViewProps {
  readonly plans: readonly PlanDto[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly creating: boolean;
  readonly onCreate: () => void;
  readonly onOpen: (planId: string) => void;
  readonly onClone: (planId: string) => void;
  readonly onDelete: (planId: string) => void;
  readonly onRetry: () => void;
  /** Dialogs of the screen (the clone modal). */
  readonly children?: React.ReactNode;
}

const SEPARATOR = ' · ';

const CARD_GRID: React.CSSProperties = {
  ...GRID_STYLE,
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const OPEN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--pb-glass-space-xs)',
  minHeight: 44,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-heading-web)',
  fontWeight: 600,
  overflowWrap: 'anywhere',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

export function PlansListView({
  plans,
  loading,
  error,
  creating,
  onCreate,
  onOpen,
  onClone,
  onDelete,
  onRetry,
  children,
}: PlansListViewProps): React.JSX.Element {
  return (
    <div style={PAGE_STYLE}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="screen.plansList.title" defaultMessage="Plans" />
        </h1>
        <Button variant="primary" loading={creating} onClick={onCreate}>
          <FormattedMessage id="screen.plansList.createButton" defaultMessage="Create new plan" />
        </Button>
      </header>

      {loading && <SkeletonList rows={3} rowHeight={96} />}

      {error !== null && !loading && <ErrorBanner message={error} onRetry={onRetry} />}

      {!loading && error === null && plans.length === 0 && (
        <EmptyState
          title={<FormattedMessage id="screen.plansList.empty" defaultMessage="No plans yet" />}
        />
      )}

      {!loading && plans.length > 0 && (
        <ul style={CARD_GRID}>
          {plans.map((plan, index) => (
            <li key={plan.id}>
              <PlanCard
                plan={plan}
                index={index}
                onOpen={onOpen}
                onClone={onClone}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}

function PlanCard({
  plan,
  index,
  onOpen,
  onClone,
  onDelete,
}: {
  plan: PlanDto;
  index: number;
  onOpen: (planId: string) => void;
  onClone: (planId: string) => void;
  onDelete: (planId: string) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const archived = isPlanArchived(plan);

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={index}
      decor={{ specular: true }}
      contentStyle={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pb-glass-space-md)',
        padding: 'var(--pb-glass-space-xl)',
      }}
    >
      <button
        type="button"
        className="pbg-ctl"
        style={OPEN_STYLE}
        onClick={() => {
          onOpen(plan.id);
        }}
      >
        <span style={NAME_STYLE}>{plan.name}</span>
        <span style={CAPTION_STYLE}>
          {periodLabel(intl, plan.periodKind)}
          {SEPARATOR}
          <FormattedMessage
            id="plan.list.period"
            defaultMessage="{start} – {end}"
            values={{
              start: formatIsoDate(plan.period.start, intl.locale),
              end: formatIsoDate(plan.period.end, intl.locale),
            }}
          />
        </span>
      </button>
      <div>
        <StatusTag
          kind={archived ? 'neutral' : 'ok'}
          icon={archived ? 'lock' : 'check'}
          label={
            archived
              ? intl.formatMessage({
                  id: 'screen.plansList.planStatus.archived',
                  defaultMessage: 'Archived',
                })
              : intl.formatMessage({
                  id: 'screen.plansList.planStatus.active',
                  defaultMessage: 'Active',
                })
          }
        />
      </div>
      <div style={ACTIONS_STYLE}>
        <Button
          variant="secondary"
          onClick={() => {
            onClone(plan.id);
          }}
        >
          <FormattedMessage id="screen.plansList.cloneButton" defaultMessage="Clone" />
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            onDelete(plan.id);
          }}
        >
          <FormattedMessage id="screen.plansList.deleteButton" defaultMessage="Delete" />
        </Button>
      </div>
    </GlassPanel>
  );
}

function periodLabel(intl: IntlShape, period: PlanPeriodKindDto): string {
  switch (period) {
    case 'weekly':
      return intl.formatMessage({
        id: 'screen.plansList.planPeriod.weekly',
        defaultMessage: 'Weekly',
      });
    case 'monthly':
      return intl.formatMessage({
        id: 'screen.plansList.planPeriod.monthly',
        defaultMessage: 'Monthly',
      });
    case 'custom':
      return intl.formatMessage({
        id: 'screen.plansList.planPeriod.custom',
        defaultMessage: 'Custom',
      });
  }
}
