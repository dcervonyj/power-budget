import React from 'react';
import { RadioGroup, type RadioOption } from './RadioGroup.js';

export interface FilterChipsProps<T extends string> {
  readonly options: ReadonlyArray<RadioOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const GROUP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

function chipStyle(selected: boolean): React.CSSProperties {
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

/** Clear-glass chip group with radio semantics (one value selected). */
export function FilterChips<T extends string>(props: FilterChipsProps<T>): React.JSX.Element {
  return <RadioGroup {...props} groupStyle={GROUP_STYLE} optionStyle={chipStyle} />;
}
