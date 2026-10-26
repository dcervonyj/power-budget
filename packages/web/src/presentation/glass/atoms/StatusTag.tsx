import React from 'react';
import type { StatusKind } from '@power-budget/shared-app';
import { Icon } from './Icon.js';
import type { IconName } from './iconPaths.js';

export interface StatusTagProps {
  readonly kind: StatusKind;
  readonly label: string;
  /** Defaults to check (ok), triangle (over) and clock (neutral). */
  readonly icon?: IconName;
}

const DEFAULT_ICONS: Readonly<Record<StatusKind, IconName>> = {
  ok: 'check',
  over: 'triangle',
  neutral: 'clock',
};

const KIND_STYLES: Readonly<Record<StatusKind, { background: string; color: string }>> = {
  ok: { background: 'var(--pb-glass-ok-tint)', color: 'var(--pb-glass-ok)' },
  over: { background: 'var(--pb-glass-over-tint)', color: 'var(--pb-glass-over)' },
  neutral: { background: 'var(--pb-glass-fill2)', color: 'var(--pb-glass-dim)' },
};

/** Pill with icon and words: status is never colour alone. */
export function StatusTag({ kind, label, icon }: StatusTagProps): React.JSX.Element {
  const style = KIND_STYLES[kind];

  return (
    <span
      data-kind={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--pb-glass-space-xs)',
        padding: '3px 10px 3px 8px',
        borderRadius: 'var(--pb-glass-radius-tag)',
        background: style.background,
        color: style.color,
        fontSize: 'var(--pb-glass-type-tag-web)',
        fontWeight: 'var(--pb-glass-type-tag-weight)',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon ?? DEFAULT_ICONS[kind]} size={14} />
      {label}
    </span>
  );
}
