import React, { useRef } from 'react';
import { nextRadioIndex } from './roving.js';
import './controls.css';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface RadioGroupProps<T extends string> {
  readonly options: ReadonlyArray<RadioOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly groupStyle: React.CSSProperties;
  readonly optionStyle: (selected: boolean) => React.CSSProperties;
}

/** Radio semantics with a roving tabindex: arrows move focus and select. */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  groupStyle,
  optionStyle,
}: RadioGroupProps<T>): React.JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function handleKeyDown(event: React.KeyboardEvent, index: number): void {
    if (disabled) {
      return;
    }
    const target = nextRadioIndex(event.key, index, options.length);
    const option = target === null ? undefined : options[target];
    if (target === null || option === undefined) {
      return;
    }
    event.preventDefault();
    onChange(option.value);
    refs.current[target]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled} style={groupStyle}>
      {options.map((option, index) => {
        const selected = index === selectedIndex;

        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={index === tabbableIndex ? 0 : -1}
            className="pbg-ctl"
            style={optionStyle(selected)}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
