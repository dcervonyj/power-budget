import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useIntl } from 'react-intl';
import { LocaleProvider, useAppLocale } from '../LocaleProvider.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../infrastructure/locale/index.js', () => {
  const actual = jest.requireActual('../../infrastructure/locale/index.js');

  return {
    ...actual,
    loadMessages: (locale: string): Promise<Record<string, string>> =>
      Promise.resolve({ greeting: locale === 'pl' ? 'Cześć' : 'Hello' }),
  };
});

let switchTo: (locale: 'pl') => void = () => undefined;

function Probe(): React.JSX.Element {
  const intl = useIntl();
  const { setLocale } = useAppLocale();
  switchTo = setLocale;

  return <Text>{intl.formatMessage({ id: 'greeting' })}</Text>;
}

describe('LocaleProvider', () => {
  it('switches language and messages at runtime', async () => {
    await render(
      <LocaleProvider deviceLanguage="en">
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeOnTheScreen();
    });

    await act(async () => {
      switchTo('pl');
    });

    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
  });

  it('ignores a delayed stored-locale read once a language was chosen', async () => {
    let releaseRead: (value: string | null) => void = () => undefined;
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(
      new Promise((resolve) => {
        releaseRead = resolve;
      }),
    );
    await render(
      <LocaleProvider deviceLanguage="en">
        <Probe />
      </LocaleProvider>,
    );

    await act(async () => {
      switchTo('pl');
    });
    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
    await act(async () => {
      releaseRead('en');
    });

    expect(screen.getByText('Cześć')).toBeOnTheScreen();
  });
});
