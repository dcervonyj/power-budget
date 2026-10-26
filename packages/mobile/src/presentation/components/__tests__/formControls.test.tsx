import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { Button } from '../Button.js';
import { Input } from '../Input.js';
import { Select } from '../Select.js';
import { renderWithProviders } from '../../glass/controls/__tests__/testWrapper.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('Button', () => {
  it('presses and exposes the button role', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button onPress={onPress}>Save</Button>);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ])('does not fire when %s', async (_name, props) => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button onPress={onPress} {...props}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    await userEvent.setup().press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders every variant', async () => {
    await renderWithProviders(
      <>
        <Button variant="primary">One</Button>
        <Button variant="secondary">Two</Button>
        <Button variant="danger">Three</Button>
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('Input', () => {
  it('reports changes and shows the error with an alert role', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <Input label="Email" value="" error="Required" onChangeText={onChangeText} />,
    );
    await userEvent.setup().type(screen.getByLabelText('Email'), 'a');

    expect(onChangeText).toHaveBeenCalledWith('a');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('toggles password visibility with a labelled button', async () => {
    await renderWithProviders(
      <Input label="Password" value="x" secureTextEntry onChangeText={jest.fn()} />,
    );
    const user = userEvent.setup();

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await user.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];

  it('opens the list, selects an option and closes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Select label="Kind" options={options} value="a" onChange={onChange} />,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('combobox', { name: 'Kind, Alpha' });

    expect(trigger).toBeCollapsed();
    await user.press(trigger);

    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Beta' })).not.toBeChecked();
    await user.press(screen.getByRole('radio', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('marks the selected option and ignores presses when disabled', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Select label="Kind" options={options} value="" disabled onChange={onChange} />,
    );
    const trigger = screen.getByRole('combobox');
    await userEvent.setup().press(trigger);

    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
