import React from 'react';
import { FormattedMessage } from 'react-intl';
import { parseMinorUnits } from '@power-budget/core';
import type { HouseholdDashboardCategoryDto } from '@power-budget/shared-app/contract';
import type { HouseholdCategoryError } from '../../../application/household/HouseholdCategoryStore.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { SkeletonList } from '../shared/SkeletonList.js';
import { HouseholdPrivacyTag } from './HouseholdPrivacyTag.js';
import {
  CAPTION_STYLE,
  CARD_HEADER_STYLE,
  CARD_TITLE_STYLE,
  PANEL_STYLE,
} from './householdStyles.js';

export interface HouseholdCategoryDrillInViewProps {
  readonly loading: boolean;
  readonly error: HouseholdCategoryError | null;
  readonly category: HouseholdDashboardCategoryDto | null;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

/** One category of the household plan, reduced to what its privacy level allows (props only). */
export function HouseholdCategoryDrillInView({
  loading,
  error,
  category,
}: HouseholdCategoryDrillInViewProps): React.JSX.Element {
  if (loading) {
    return <SkeletonList rows={2} rowHeight={96} />;
  }
  if (error !== null) {
    return <ErrorBanner message={<DrillInErrorText error={error} />} />;
  }
  if (category === null) {
    return <div />;
  }

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={0}
      decor={{ specular: true }}
      contentStyle={PANEL_STYLE}
    >
      <div style={CARD_HEADER_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>{category.categoryName}</h2>
        <HouseholdPrivacyTag level={category.privacyLevel} />
      </div>
      <span style={LABEL_STYLE}>
        <PrivacyLevelText level={category.privacyLevel} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xs)' }}>
        <span style={LABEL_STYLE}>
          <FormattedMessage id="component.household.privacy.total" defaultMessage="Total spend" />
        </span>
        <AmountText
          size="figure"
          amount={{
            amountMinor: parseMinorUnits(category.totalAmountMinor),
            currency: category.currency,
          }}
        />
      </div>
      {category.privacyLevel !== 'total_only' && (
        // The dashboard has no per-transaction lines yet (no category transactions endpoint).
        <span style={CAPTION_STYLE}>
          <FormattedMessage
            id="component.household.privacy.totalAndCount"
            defaultMessage="{count, plural, one {# transaction} other {# transactions}}"
            values={{ count: category.transactionCount }}
          />
        </span>
      )}
    </GlassPanel>
  );
}

function PrivacyLevelText({
  level,
}: {
  level: HouseholdDashboardCategoryDto['privacyLevel'];
}): React.JSX.Element {
  switch (level) {
    case 'total_only':
      return (
        <FormattedMessage
          id="component.household.privacy.level.total"
          defaultMessage="Summary only"
        />
      );
    case 'total_with_counts':
      return (
        <FormattedMessage
          id="component.household.privacy.level.totalAndCount"
          defaultMessage="Summary + count"
        />
      );
    case 'full_detail':
      return (
        <FormattedMessage
          id="component.household.privacy.level.fullDetail"
          defaultMessage="Full detail"
        />
      );
  }
}

function DrillInErrorText({ error }: { error: HouseholdCategoryError }): React.JSX.Element {
  switch (error) {
    case 'not_found':
      return (
        <FormattedMessage
          id="component.household.notFound"
          defaultMessage="This category is not in the plan"
        />
      );
    case 'fx_unavailable':
      return (
        <FormattedMessage
          id="common.fxRateUnavailable"
          defaultMessage="Exchange rates are not available right now. Please try again later."
        />
      );
    case 'failed':
      return (
        <FormattedMessage
          id="component.household.error"
          defaultMessage="Failed to load category details"
        />
      );
  }
}
