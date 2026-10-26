import type React from 'react';

/** Panel padding: D7 28/32 px on desktop, tighter on a phone so the 264 px lens still fits. */
export const PANEL_PADDING = 'clamp(18px, 3vw, 28px) clamp(16px, 3vw, 32px)';

export const PANEL_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-heading-web)',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--pb-glass-fg)',
};

/** "Safe to spend today", "Pace": a dim panel label above a figure. */
export const PANEL_LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 500,
  color: 'var(--pb-glass-dim)',
};

export const DIM_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

export const BODY_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-body-web)',
  lineHeight: 1.5,
  color: 'var(--pb-glass-fg)',
};

export const PANEL_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '6px 16px',
};

export const LIST_RESET_STYLE: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

/** A small clear-glass card on a panel: stat tiles, the to-sort link. */
export const CLEAR_CARD_STYLE: React.CSSProperties = {
  borderRadius: 'var(--pb-glass-radius-tile)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
};

/** Content column inside the app shell: the D7 1280 px container. */
export const OVERVIEW_CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 1280,
  margin: '0 auto',
  padding: '0 var(--pb-glass-space-lg)',
  boxSizing: 'border-box',
  color: 'var(--pb-glass-fg)',
  // The hero's depth panes peek out sideways; never let them scroll the page at 390 px.
  overflowX: 'clip',
};
