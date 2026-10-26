import React from 'react';
import { IconButton } from './IconButton.js';
import './controls.css';

export interface StepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly formatValue?: (value: number) => string;
}

const MINUS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M3 8h10" />
  </svg>
);

const PLUS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M3 8h10M8 3v10" />
  </svg>
);

export function Stepper({
  value,
  onChange,
  label,
  decrementLabel,
  incrementLabel,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
  formatValue = String,
}: StepperProps): React.JSX.Element {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  function commit(next: number): void {
    const clamped = Math.min(max, Math.max(min, next));
    if (!disabled && clamped !== value) {
      onChange(clamped);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    const next = nextValue(event.key);
    if (next === null) {
      return;
    }
    event.preventDefault();
    commit(next);
  }

  function nextValue(key: string): number | null {
    switch (key) {
      case 'ArrowUp':
      case 'ArrowRight':
        return value + step;
      case 'ArrowDown':
      case 'ArrowLeft':
        return value - step;
      case 'Home':
        return Number.isFinite(min) ? min : null;
      case 'End':
        return Number.isFinite(max) ? max : null;
      default:
        return null;
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--pb-glass-space-xs)' }}
    >
      <IconButton
        label={decrementLabel}
        disabled={!canDecrement}
        tabIndex={-1}
        onClick={() => {
          commit(value - step);
        }}
      >
        {MINUS}
      </IconButton>
      <span
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={formatValue(value)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="pbg-ctl"
        onKeyDown={handleKeyDown}
        style={{
          minWidth: 56,
          padding: '0 var(--pb-glass-space-sm)',
          textAlign: 'center',
          borderRadius: 'var(--pb-glass-radius-control)',
          color: 'var(--pb-glass-fg)',
          fontSize: 'var(--pb-glass-type-amount-web)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: '44px',
        }}
      >
        {formatValue(value)}
      </span>
      <IconButton
        label={incrementLabel}
        disabled={!canIncrement}
        tabIndex={-1}
        onClick={() => {
          commit(value + step);
        }}
      >
        {PLUS}
      </IconButton>
    </div>
  );
}
