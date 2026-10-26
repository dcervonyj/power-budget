import React from 'react';
import { useIntl } from 'react-intl';
import { SkeletonBlock } from './SkeletonBlock.js';

export interface SkeletonListProps {
  rows?: number;
  rowHeight?: number;
}

export function SkeletonList({ rows = 3, rowHeight = 56 }: SkeletonListProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={intl.formatMessage({
        id: 'component.shared.loading',
        defaultMessage: 'Loading...',
      })}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xs)' }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={rowHeight} borderRadius={16} />
      ))}
    </div>
  );
}
