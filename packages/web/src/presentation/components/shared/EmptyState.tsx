import React from 'react';
import { useTheme } from '../ThemeContext.js';

export interface EmptyStateProps {
  icon?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: {
    label: React.ReactNode;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${String(theme.space['2xl'])}px ${String(theme.space.lg)}px`,
        gap: theme.space.md,
        textAlign: 'center',
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
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        {title}
      </p>
      {subtitle !== undefined && (
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSize.sm,
            color: theme.color.text.secondary,
          }}
        >
          {subtitle}
        </p>
      )}
      {action !== undefined && (
        <button
          type="button"
          onClick={action.onPress}
          style={{
            marginTop: theme.space.xs,
            padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
            borderRadius: theme.radius.md,
            border: 'none',
            backgroundColor: theme.color.accent.default,
            color: theme.color.accent.onAccent,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
