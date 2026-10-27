import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { parseMinorUnits } from '@power-budget/core';
import type { HouseholdDashboardCategoryDto } from '@power-budget/shared-app/contract';
import type { HouseholdAggregatesError } from '../../../application/household/HouseholdStore.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import '../../glass/controls/controls.css';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { CategoryRow } from '../../glass/rows/CategoryRow.js';
import { LINE_STYLE, ROW_STYLE, SMALL_STYLE, TITLE_STYLE } from '../../glass/rows/rowStyles.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import { Select } from '../Select.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { SkeletonList } from '../shared/SkeletonList.js';
import { HouseholdPrivacyTag, usePrivacyLabel } from './HouseholdPrivacyTag.js';
import {
  CAPTION_STYLE,
  CARD_TITLE_STYLE,
  PANEL_STYLE,
  PLAIN_LIST_STYLE,
} from './householdStyles.js';

export interface HouseholdPlanOption {
  readonly id: string;
  readonly name: string;
}

export interface HouseholdAggregatesCardViewProps {
  readonly plans: readonly HouseholdPlanOption[];
  readonly selectedPlanId: string | null;
  readonly categories: readonly HouseholdDashboardCategoryDto[];
  readonly loading: boolean;
  readonly error: HouseholdAggregatesError | null;
  readonly onSelectPlan: (planId: string) => void;
}

const ACTION_LINK_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: 'var(--pb-glass-accent)',
  fontSize: 'var(--pb-glass-type-small-web)',
  fontWeight: 600,
};

/** Both members' totals per category of a household plan, as privacy allows (props only). */
export function HouseholdAggregatesCardView({
  plans,
  selectedPlanId,
  categories,
  loading,
  error,
  onSelectPlan,
}: HouseholdAggregatesCardViewProps): React.JSX.Element {
  const intl = useIntl();
  const ready = selectedPlanId !== null && error === null && !loading;

  function retry(): void {
    if (selectedPlanId !== null) {
      onSelectPlan(selectedPlanId);
    }
  }

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={1}
      decor={{ specular: true }}
      contentStyle={PANEL_STYLE}
    >
      <section aria-labelledby="household-aggregates-title" style={{ display: 'contents' }}>
        <h2 id="household-aggregates-title" style={CARD_TITLE_STYLE}>
          <FormattedMessage id="household.aggregates.title" defaultMessage="Shared spending" />
        </h2>
        <span style={CAPTION_STYLE}>
          <FormattedMessage
            id="household.aggregates.explainer"
            defaultMessage="Totals include both of you. Your partner's transactions are shown as each category's privacy level allows; accounts and balances are never shared."
          />
        </span>

        {plans.length === 0 && (
          <span style={CAPTION_STYLE}>
            <FormattedMessage
              id="household.aggregates.noPlan"
              defaultMessage="No household plan yet. Create a plan of type Household to see shared totals."
            />
            <Link to="/plans" style={{ ...ACTION_LINK_STYLE, marginInlineStart: 8 }}>
              <FormattedMessage id="household.aggregates.toPlans" defaultMessage="Go to plans" />
            </Link>
          </span>
        )}

        {plans.length > 1 && (
          <Select<string>
            id="household-plan"
            label={intl.formatMessage({ id: 'household.aggregates.plan', defaultMessage: 'Plan' })}
            options={plans.map(planOption)}
            value={selectedPlanId === null ? '' : selectedPlanId}
            onChange={onSelectPlan}
          />
        )}
        {plans.length === 1 && <span style={TITLE_STYLE}>{plans[0]?.name}</span>}

        {loading && <SkeletonList rows={3} rowHeight={72} />}

        {error === 'fx_unavailable' && (
          <ErrorBanner
            message={
              <FormattedMessage
                id="common.fxRateUnavailable"
                defaultMessage="Exchange rates are not available right now. Please try again later."
              />
            }
            onRetry={retry}
          />
        )}
        {error === 'failed' && (
          <ErrorBanner
            message={
              <FormattedMessage
                id="household.aggregates.failed"
                defaultMessage="Shared totals could not be loaded."
              />
            }
            onRetry={retry}
          />
        )}

        {ready && categories.length === 0 && (
          <span style={CAPTION_STYLE}>
            <FormattedMessage
              id="household.aggregates.empty"
              defaultMessage="No transactions in this plan's period yet."
            />
          </span>
        )}
        {ready && categories.length > 0 && (
          <ul style={PLAIN_LIST_STYLE}>
            {categories.map((category) => (
              <li key={category.categoryId}>
                <SharedCategory category={category} planId={selectedPlanId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </GlassPanel>
  );
}

function planOption(plan: HouseholdPlanOption): { value: string; label: string } {
  return { value: plan.id, label: plan.name };
}

/**
 * total_only: only the sum (the count would reveal the partner's activity);
 * total_with_counts: sum and count; full_detail: sum, count and a link to details.
 */
function SharedCategory({
  category,
  planId,
}: {
  category: HouseholdDashboardCategoryDto;
  planId: string;
}): React.JSX.Element {
  const intl = useIntl();
  const total = {
    amountMinor: parseMinorUnits(category.totalAmountMinor),
    currency: category.currency,
  };
  const privacy = usePrivacyLabel(category.privacyLevel);

  if (category.privacyLevel === 'total_only') {
    return (
      <CategoryRow
        category={{
          id: category.categoryId,
          label: category.categoryName,
          spentMinor: total.amountMinor,
          plannedMinor: 0n,
          currency: category.currency,
          status: 'neutral',
          paid: false,
          totalOnly: true,
        }}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={intl.formatMessage(
        { id: 'household.aggregates.row.aria', defaultMessage: '{name}: {total}, {privacy}' },
        { name: category.categoryName, total: formatAmount(total, intl.locale), privacy },
      )}
      style={ROW_STYLE}
    >
      <div style={LINE_STYLE}>
        <span style={TITLE_STYLE}>{category.categoryName}</span>
        <span style={{ fontSize: 'var(--pb-glass-type-panel-label-web)' }}>
          <AmountText amount={total} />
        </span>
      </div>
      <div style={LINE_STYLE}>
        <HouseholdPrivacyTag level={category.privacyLevel} />
        <span style={SMALL_STYLE}>
          <FormattedMessage
            id="household.aggregates.count"
            defaultMessage="{count, plural, one {# transaction} other {# transactions}}"
            values={{ count: category.transactionCount }}
          />
        </span>
        {category.privacyLevel === 'full_detail' && (
          <Link
            to={`/household?planId=${encodeURIComponent(planId)}&categoryId=${encodeURIComponent(category.categoryId)}`}
            className="pbg-ctl"
            style={ACTION_LINK_STYLE}
          >
            <FormattedMessage id="household.aggregates.details" defaultMessage="Details" />
          </Link>
        )}
      </div>
    </div>
  );
}
