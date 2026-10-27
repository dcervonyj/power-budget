import type React from 'react';

export const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 1280,
  margin: '0 auto',
  padding: 'var(--pb-glass-space-lg)',
  boxSizing: 'border-box',
  color: 'var(--pb-glass-fg)',
};

export const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-md)',
};

export const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-title-web)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

export const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

export const PANEL_CONTENT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-xl)',
};

export const PANEL_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 600,
  color: 'var(--pb-glass-fg)',
};

export const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--pb-glass-space-md)',
};

export const FIELD_INPUT_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  minHeight: 44,
  width: '100%',
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
  fontVariantNumeric: 'tabular-nums',
};
