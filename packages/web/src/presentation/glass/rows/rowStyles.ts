import type React from 'react';

export const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-md) var(--pb-glass-space-lg)',
  borderRadius: 'var(--pb-glass-radius-tile)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
};

export const LINE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--pb-glass-space-md)',
  flexWrap: 'wrap',
};

export const MAIN_BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-md)',
  flex: '1 1 160px',
  minHeight: 44,
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
};

export const PLAIN_MAIN_STYLE: React.CSSProperties = {
  ...MAIN_BUTTON_STYLE,
  cursor: 'default',
};

export const TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  overflowWrap: 'anywhere',
};

export const SMALL_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

export const TEXT_COLUMN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};
