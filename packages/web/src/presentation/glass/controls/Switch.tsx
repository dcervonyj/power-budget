import React from 'react';
import './controls.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 24;
const INSET = 4;

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: SwitchProps): React.JSX.Element {
  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
      if (!disabled) {
        onChange(!checked);
      }
    }
  }

  // The browser would also click on Space keyup; keydown already toggled.
  function handleKeyUp(event: React.KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="pbg-ctl"
      onClick={() => {
        onChange(!checked);
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{
        position: 'relative',
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        padding: 0,
        border: 'none',
        borderRadius: TRACK_HEIGHT / 2,
        background: checked ? 'var(--pb-glass-light-solid)' : 'var(--pb-glass-clear)',
        boxShadow: checked
          ? 'inset 0 0 0 1px var(--pb-glass-light-edge)'
          : 'var(--pb-glass-clear-rim)',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: INSET,
          left: INSET,
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: checked ? 'var(--pb-glass-accent-ink)' : 'var(--pb-glass-fg)',
          transform: `translateX(${checked ? TRACK_WIDTH - THUMB - 2 * INSET : 0}px)`,
          transition:
            'transform var(--pb-glass-motion-press-duration-ms, 220ms) var(--pb-glass-motion-press-easing, ease)',
        }}
      />
    </button>
  );
}
