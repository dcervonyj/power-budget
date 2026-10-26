import React from 'react';
import { Button } from '../Button.js';

export interface EmptyStateProps {
  icon?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: {
    label: React.ReactNode;
    onPress: () => void;
  };
}

/** Centred empty state on clear glass: optional glyph, title, subtitle and one action. */
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--pb-glass-space-3xl) var(--pb-glass-space-md)',
        gap: 'var(--pb-glass-space-sm)',
        textAlign: 'center',
        borderRadius: 'var(--pb-glass-radius-tile)',
        background: 'var(--pb-glass-clear)',
        boxShadow: 'var(--pb-glass-clear-rim)',
      }}
    >
      {icon !== undefined && (
        <span aria-hidden="true" style={{ fontSize: 48, lineHeight: 1 }}>
          {icon}
        </span>
      )}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--pb-glass-type-heading-web)',
          fontWeight: 600,
          color: 'var(--pb-glass-fg)',
        }}
      >
        {title}
      </p>
      {subtitle !== undefined && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--pb-glass-type-body-web)',
            color: 'var(--pb-glass-dim)',
          }}
        >
          {subtitle}
        </p>
      )}
      {action !== undefined && (
        <div style={{ marginTop: 'var(--pb-glass-space-xs)' }}>
          <Button variant="primary" onClick={action.onPress}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
