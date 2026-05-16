import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.js';

export interface UnplannedSectionProps {
  count: number;
  totalMinor: number;
  currency: string;
}

export const UnplannedSection = observer(function UnplannedSection({
  count,
  totalMinor,
  currency,
}: UnplannedSectionProps): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const intl = useIntl();

  const formattedTotal = intl.formatNumber(totalMinor / 100, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });

  function handleClick(): void {
    navigate('/transactions?filter=unplanned');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.space.lg,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.color.border.subtle}`,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        gap: theme.space.md,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage
          id="screen.dashboard.unplanned"
          values={{ count }}
          defaultMessage="Unplanned ({count})"
        />
      </span>
      <span
        style={{
          fontSize: theme.fontSize.sm,
          color: theme.color.text.secondary,
          flexShrink: 0,
        }}
        aria-label={formattedTotal}
      >
        {formattedTotal}
      </span>
    </button>
  );
});
