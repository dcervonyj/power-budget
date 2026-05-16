import React from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from '../ThemeContext.js';

export interface SyncStatusChipProps {
  lastSuccessfulAt: Date | null;
}

function getRelativeLabel(date: Date | null): {
  id: string;
  values?: Record<string, string | number>;
} {
  if (date === null) {
    return { id: 'bankConnections.neverSynced' };
  }
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 60) {
    return {
      id: 'bankConnections.lastSynced',
      values: {
        time: diffMin <= 1 ? '1 min ago' : `${String(diffMin)} min ago`,
      },
    };
  }
  if (diffHours < 24) {
    return {
      id: 'bankConnections.lastSynced',
      values: { time: `${String(diffHours)}h ago` },
    };
  }
  if (diffDays === 1) {
    return {
      id: 'bankConnections.lastSynced',
      values: { time: 'yesterday' },
    };
  }
  return {
    id: 'bankConnections.lastSynced',
    values: { time: `${String(diffDays)} days ago` },
  };
}

export function SyncStatusChip({ lastSuccessfulAt }: SyncStatusChipProps): React.JSX.Element {
  const theme = useTheme();
  const label = getRelativeLabel(lastSuccessfulAt);

  return (
    <span
      style={{
        fontSize: theme.fontSize.sm,
        color: theme.color.text.secondary,
      }}
    >
      <FormattedMessage id={label.id} values={label.values} />
    </span>
  );
}
