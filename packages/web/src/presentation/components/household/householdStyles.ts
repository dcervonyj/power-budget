import type React from 'react';

export const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-xl)',
};

export const CARD_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--pb-glass-space-md)',
};

export const CARD_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 600,
  color: 'var(--pb-glass-fg)',
};

export const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

export const PLAIN_LIST_STYLE: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
};

export const LINK_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  textDecoration: 'none',
};
