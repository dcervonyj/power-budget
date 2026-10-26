import React from 'react';

export interface CountBadgeProps {
  readonly count: number;
  /** Counts above this show as `max+`. */
  readonly max?: number;
}

export function CountBadge({ count, max = 99 }: CountBadgeProps): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        boxSizing: 'border-box',
        borderRadius: 10,
        background: 'var(--pb-glass-light-solid)',
        color: 'var(--pb-glass-accent-ink)',
        fontSize: 'var(--pb-glass-type-tag-web)',
        fontWeight: 'var(--pb-glass-type-tag-weight)',
        lineHeight: 1,
      }}
    >
      {formatCount(count, max)}
    </span>
  );
}

function formatCount(count: number, max: number): string {
  return count > max ? `${max}+` : String(count);
}
