import React from 'react';
import { RadioGroup, type RadioOption } from './RadioGroup.js';

export interface SegmentedControlProps<T extends string> {
  readonly options: ReadonlyArray<RadioOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--pb-glass-space-xxs)',
  padding: 'var(--pb-glass-space-xxs)',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-track)',
};

function segmentStyle(selected: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 44,
    border: 'none',
    borderRadius: 'calc(var(--pb-glass-radius-control) - 4px)',
    background: selected ? 'var(--pb-glass-g0)' : 'transparent',
    boxShadow: selected ? 'var(--pb-glass-clear-rim)' : 'none',
    color: selected ? 'var(--pb-glass-fg)' : 'var(--pb-glass-dim)',
    fontSize: 'var(--pb-glass-type-small-web)',
    fontWeight: 'var(--pb-glass-type-label-weight)',
    cursor: 'pointer',
  };
}

/** Equal-width segmented picker with radio semantics. */
export function SegmentedControl<T extends string>(
  props: SegmentedControlProps<T>,
): React.JSX.Element {
  return <RadioGroup {...props} groupStyle={GROUP_STYLE} optionStyle={segmentStyle} />;
}
