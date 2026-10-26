import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CountBadge } from '../CountBadge.js';
import { FilterChips } from '../FilterChips.js';
import { IconButton } from '../IconButton.js';
import { SegmentedControl } from '../SegmentedControl.js';
import { Stepper } from '../Stepper.js';
import { Switch } from '../Switch.js';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) {
    throw new Error(`no item at ${index}`);
  }

  return item;
}

describe('Switch', () => {
  it('exposes switch role and checked state', () => {
    render(<Switch label="Sync" checked onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Sync' }).getAttribute('aria-checked')).toBe('true');
  });

  it('toggles on Space', () => {
    const onChange = vi.fn();
    render(<Switch label="Sync" checked={false} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('toggles on click and not when disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="Sync" checked onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    onChange.mockClear();
    rerender(<Switch label="Sync" checked disabled onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Stepper', () => {
  function renderStepper(onChange: (value: number) => void, value = 3): void {
    render(
      <Stepper
        label="Quantity"
        decrementLabel="Less"
        incrementLabel="More"
        value={value}
        min={0}
        max={5}
        onChange={onChange}
      />,
    );
  }

  it('exposes spinbutton value range', () => {
    renderStepper(() => {});
    const spin = screen.getAllByRole('spinbutton')[0];
    expect(spin?.getAttribute('aria-valuenow')).toBe('3');
    expect(spin?.getAttribute('aria-valuemin')).toBe('0');
    expect(spin?.getAttribute('aria-valuemax')).toBe('5');
  });

  it('changes with arrow keys', () => {
    const onChange = vi.fn();
    renderStepper(onChange);
    const spin = screen.getByRole('spinbutton');
    fireEvent.keyDown(spin, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(spin, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(spin, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('clamps at the bounds', () => {
    const onChange = vi.fn();
    renderStepper(onChange, 5);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'More' }).hasAttribute('disabled')).toBe(true);
  });

  it('steps with the buttons', () => {
    const onChange = vi.fn();
    renderStepper(onChange);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4);
  });
});

describe.each([
  ['FilterChips', FilterChips],
  ['SegmentedControl', SegmentedControl],
])('%s', (_name, Component) => {
  it('has radio semantics with a single tab stop', () => {
    render(<Component label="Group" options={OPTIONS} value="b" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Group' })).toBeDefined();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves selection and focus with arrow keys, wrapping', () => {
    const onChange = vi.fn();
    render(<Component label="Group" options={OPTIONS} value="c" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(at(radios, 2), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(at(radios, 2), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('selects on click and ignores keys when disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Component label="Group" options={OPTIONS} value="a" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('c');
    onChange.mockClear();
    rerender(<Component label="Group" options={OPTIONS} value="a" disabled onChange={onChange} />);
    fireEvent.keyDown(at(screen.getAllByRole('radio'), 0), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('IconButton and CountBadge', () => {
  it('names the icon button and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Settings" onClick={onClick}>
        <svg />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('caps the badge count', () => {
    render(
      <>
        <CountBadge count={7} />
        <CountBadge count={120} />
      </>,
    );
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('99+')).toBeDefined();
  });
});
