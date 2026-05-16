import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '../ThemeContext.js';
import { SkeletonBlock } from './SkeletonBlock.js';

export interface SkeletonListProps {
  rows?: number;
  rowHeight?: number;
}

export function SkeletonList({ rows = 3, rowHeight = 56 }: SkeletonListProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  return (
    <div
      aria-busy="true"
      aria-label={intl.formatMessage({
        id: 'component.shared.loading',
        defaultMessage: 'Loading...',
      })}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={rowHeight} borderRadius={theme.radius.md} />
      ))}
    </div>
  );
}
