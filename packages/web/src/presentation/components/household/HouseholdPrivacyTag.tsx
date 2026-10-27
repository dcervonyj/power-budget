import React from 'react';
import { useIntl } from 'react-intl';
import type { CategoryPrivacyDto } from '@power-budget/shared-app/contract';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import type { IconName } from '../../glass/atoms/iconPaths.js';

export interface HouseholdPrivacyTagProps {
  readonly level: CategoryPrivacyDto;
}

const ICONS: Readonly<Record<CategoryPrivacyDto, IconName>> = {
  full_detail: 'users',
  total_with_counts: 'lock',
  total_only: 'lock',
};

/** What the partner sees of a category, in words (never colour alone). */
export function HouseholdPrivacyTag({ level }: HouseholdPrivacyTagProps): React.JSX.Element {
  return <StatusTag kind="neutral" icon={ICONS[level]} label={usePrivacyLabel(level)} />;
}

export function usePrivacyLabel(level: CategoryPrivacyDto): string {
  const intl = useIntl();
  switch (level) {
    case 'full_detail':
      return intl.formatMessage({
        id: 'household.privacy.fullDetail',
        defaultMessage: 'Full detail',
      });
    case 'total_with_counts':
      return intl.formatMessage({
        id: 'household.privacy.totalWithCounts',
        defaultMessage: 'Total + count',
      });
    case 'total_only':
      return intl.formatMessage({
        id: 'household.privacy.totalOnly',
        defaultMessage: 'Total only',
      });
  }
}
