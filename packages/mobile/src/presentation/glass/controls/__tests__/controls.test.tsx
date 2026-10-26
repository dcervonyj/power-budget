import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { CountBadge } from '../CountBadge.js';
import { FilterChips } from '../FilterChips.js';
import { IconButton } from '../IconButton.js';
import { Keypad } from '../Keypad.js';
import { SegmentedControl } from '../SegmentedControl.js';
import { Stepper } from '../Stepper.js';
import { Switch } from '../Switch.js';
import { renderWithProviders } from './testWrapper.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('Switch', () => {
  it('exposes switch role and checked state and toggles on press', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Switch label="Sync" checked onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Sync' });

    expect(control).toBeChecked();
    await userEvent.setup().press(control);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not fire when disabled and reports the disabled state', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Switch label="Sync" checked={false} disabled onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Sync' });

    expect(control).toBeDisabled();
    await userEvent.setup().press(control);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is a labelled button that presses and can be disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <IconButton label="Close" onPress={onPress}>
          {null}
        </IconButton>
        <IconButton label="Locked" disabled onPress={onPress}>
          {null}
        </IconButton>
      </>,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Close' }));
    await user.press(screen.getByRole('button', { name: 'Locked' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Locked' })).toBeDisabled();
  });
});

describe('Stepper', () => {
  it('steps within bounds and disables the buttons at the limits', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Stepper
        value={3}
        min={0}
        max={3}
        label="Days"
        decrementLabel="Fewer"
        incrementLabel="More"
        onChange={onChange}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Fewer' }));

    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole('adjustable', { name: 'Days' })).toBeTruthy();
  });

  it('disables both buttons when disabled', async () => {
    await renderWithProviders(
      <Stepper
        value={1}
        label="Days"
        decrementLabel="Fewer"
        incrementLabel="More"
        disabled
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Fewer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
  });
});

describe.each([
  ['FilterChips', FilterChips],
  ['SegmentedControl', SegmentedControl],
])('%s', (_name, Group) => {
  it('has radio semantics, selected state and fires onChange', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Group label="Mode" options={OPTIONS} value="a" onChange={onChange} />,
    );

    expect(screen.getByLabelText('Mode')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Beta' })).not.toBeChecked();
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('ignores presses when disabled', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Group label="Mode" options={OPTIONS} value="a" disabled onChange={onChange} />,
    );
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Beta' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeDisabled();
  });
});

describe('CountBadge', () => {
  it('caps the visible count and uses an explicit label when given', async () => {
    await renderWithProviders(<CountBadge count={120} label="120 unread" />);

    expect(screen.getByLabelText('120 unread')).toBeTruthy();
    expect(screen.getByText('99+', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Keypad', () => {
  it('types digits, decimal and backspace through onChange', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Keypad value="12" onChange={onChange} submitLabel="Save" backspaceLabel="Delete" />,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: '7' }));
    await user.press(screen.getByRole('button', { name: '.' }));
    await user.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange).toHaveBeenNthCalledWith(1, '127');
    expect(onChange).toHaveBeenNthCalledWith(2, '12.');
    expect(onChange).toHaveBeenNthCalledWith(3, '1');
  });

  it('submits only when there is a value and it is enabled', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(
      <Keypad
        value=""
        onChange={jest.fn()}
        onSubmit={onSubmit}
        submitLabel="Save"
        backspaceLabel="Delete"
      />,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('presses submit with a value', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(
      <Keypad
        value="5"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        submitLabel="Save"
        backspaceLabel="Delete"
      />,
    );
    await userEvent.setup().press(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
