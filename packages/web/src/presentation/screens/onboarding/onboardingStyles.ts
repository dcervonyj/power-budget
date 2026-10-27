import type React from 'react';

export const STEP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
};

export const STEP_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-heading-web)',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--pb-glass-fg)',
};

export const STEP_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-body-web)',
  color: 'var(--pb-glass-dim)',
  lineHeight: 1.5,
};

export const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--pb-glass-space-sm)',
};

export const STACK_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 'var(--pb-glass-space-sm)',
};

/** A link that looks like the primary / secondary `Button`. */
export function linkButtonStyle(primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '0 var(--pb-glass-space-lg)',
    borderRadius: 'var(--pb-glass-radius-control)',
    fontSize: 'var(--pb-glass-type-label-web)',
    fontWeight: 'var(--pb-glass-type-label-weight)',
    textDecoration: 'none',
    background: primary ? 'var(--pb-glass-light-solid)' : 'var(--pb-glass-clear)',
    boxShadow: primary ? 'inset 0 0 0 1px var(--pb-glass-light-edge)' : 'var(--pb-glass-clear-rim)',
    color: primary ? 'var(--pb-glass-accent-ink)' : 'var(--pb-glass-fg)',
  };
}

/** A language row: one per line, the chosen one carries the light. */
export function optionRowStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    padding: '0 var(--pb-glass-space-md)',
    border: 'none',
    borderRadius: 'var(--pb-glass-radius-control)',
    background: selected ? 'var(--pb-glass-light-solid)' : 'var(--pb-glass-clear)',
    boxShadow: selected
      ? 'inset 0 0 0 1px var(--pb-glass-light-edge)'
      : 'var(--pb-glass-clear-rim)',
    color: selected ? 'var(--pb-glass-accent-ink)' : 'var(--pb-glass-fg)',
    fontSize: 'var(--pb-glass-type-body-web)',
    fontWeight: selected ? 600 : 400,
    textAlign: 'start',
    cursor: 'pointer',
  };
}

/** A currency chip (multi-select toggle). */
export function chipToggleStyle(selected: boolean): React.CSSProperties {
  return {
    minHeight: 44,
    minWidth: 64,
    padding: '0 var(--pb-glass-space-md)',
    border: 'none',
    borderRadius: 'var(--pb-glass-radius-chip)',
    background: selected ? 'var(--pb-glass-light-solid)' : 'var(--pb-glass-clear)',
    boxShadow: selected
      ? 'inset 0 0 0 1px var(--pb-glass-light-edge)'
      : 'var(--pb-glass-clear-rim)',
    color: selected ? 'var(--pb-glass-accent-ink)' : 'var(--pb-glass-fg)',
    fontSize: 'var(--pb-glass-type-small-web)',
    fontWeight: 'var(--pb-glass-type-label-weight)',
    cursor: 'pointer',
  };
}
