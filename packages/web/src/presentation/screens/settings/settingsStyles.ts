import type React from 'react';

export const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-xl)',
};

export const HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 600,
  color: 'var(--pb-glass-fg)',
};

export const NOTE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

export const FIELDS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  maxWidth: 400,
};

export const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-md)',
};

export const SUCCESS_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-fg)',
};

export const ERROR_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-fg)',
};

export function chipStyle(selected: boolean): React.CSSProperties {
  return {
    minHeight: 44,
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
