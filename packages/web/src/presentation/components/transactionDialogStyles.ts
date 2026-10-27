import type React from 'react';

/** Glass tokens shared by the transaction detail, map and manual-add dialogs. */
export const DIALOG_COLUMN: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
};

export const DIALOG_SECTION: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
  paddingTop: 'var(--pb-glass-space-md)',
  borderTop: '1px solid var(--pb-glass-edge)',
};

export const FIELD_LABEL: React.CSSProperties = {
  display: 'block',
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

export const FIELD_CONTROL: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box',
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
};

export const TEXT_AREA_CONTROL: React.CSSProperties = {
  ...FIELD_CONTROL,
  padding: 'var(--pb-glass-space-sm) var(--pb-glass-space-md)',
  resize: 'vertical',
};

export const MUTED_TEXT: React.CSSProperties = {
  margin: 0,
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

export const ALERT_TEXT: React.CSSProperties = {
  margin: 0,
  color: 'var(--pb-glass-over)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

export const SPLIT_LINE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-sm)',
};

/** A clear-material tile that is the radio option of a picker; the selected one gets the light rim. */
export function optionStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--pb-glass-space-md)',
    minHeight: 44,
    padding: 'var(--pb-glass-space-sm) var(--pb-glass-space-md)',
    border: 'none',
    borderRadius: 'var(--pb-glass-radius-tile)',
    background: selected ? 'var(--pb-glass-fill2)' : 'var(--pb-glass-clear)',
    boxShadow: selected ? 'inset 0 0 0 2px var(--pb-glass-fg)' : 'var(--pb-glass-clear-rim)',
    color: 'var(--pb-glass-fg)',
    fontFamily: 'inherit',
    fontSize: 'var(--pb-glass-type-body-web)',
    textAlign: 'start',
    cursor: 'pointer',
  };
}
