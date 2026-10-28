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

let switchTo: (
  locale: 'pl' | 'en',
  source?: 'stored' | 'server' | 'user',
  sessionId?: number,
) => void = () => undefined;

function Probe(): React.JSX.Element {
  const intl = useIntl();
  const { setLocale } = useAppLocale();
  switchTo = setLocale;

  return <Text>{intl.formatMessage({ id: 'greeting' })}</Text>;
}

describe('LocaleProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

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

  it('user choice beats a delayed stored read', async () => {
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

  async function renderWithDelayedStoredRead(): Promise<(value: string | null) => void> {
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

    return releaseRead;
  }

  it('server locale beats a delayed stored read', async () => {
    const releaseRead = await renderWithDelayedStoredRead();

    await act(async () => {
      switchTo('pl', 'server');
    });
    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
    await act(async () => {
      releaseRead('en');
    });

    expect(screen.getByText('Cześć')).toBeOnTheScreen();
  });

  it('user choice beats a later server locale', async () => {
    await render(
      <LocaleProvider deviceLanguage="en">
        <Probe />
      </LocaleProvider>,
    );

    await act(async () => {
      switchTo('pl', 'user');
    });
    await act(async () => {
      switchTo('en', 'server');
    });

    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
  });

  it('server locale beats a later stored read', async () => {
    const releaseRead = await renderWithDelayedStoredRead();
    await act(async () => {
      switchTo('pl', 'server');
    });
    await act(async () => {
      releaseRead('en');
    });

    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
  });

  it("forgets the previous user's choice when the session changes", async () => {
    const tree = (sessionKey: boolean): React.JSX.Element => (
      <LocaleProvider deviceLanguage="en" sessionKey={sessionKey}>
        <Probe />
      </LocaleProvider>
    );
    const view = await render(tree(true));
    await act(async () => {
      switchTo('pl', 'user');
    });
    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });

    await view.rerender(tree(false));
    await act(async () => {
      switchTo('en', 'server');
    });

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeOnTheScreen();
    });
  });

  it('rejects a late locale update from a previous session', async () => {
    let sessionId = 1;
    await render(
      <LocaleProvider deviceLanguage="en" getSessionId={() => sessionId}>
        <Probe />
      </LocaleProvider>,
    );

    sessionId = 2;
    await act(async () => {
      switchTo('pl', 'user', 1);
    });

    expect(screen.queryByText('Cześć')).toBeNull();
    await act(async () => {
      switchTo('pl', 'user', 2);
    });
    await waitFor(() => {
      expect(screen.getByText('Cześć')).toBeOnTheScreen();
    });
  });

  it('rejects a previous-session update that finishes loading after the session ended', async () => {
    let sessionId = 1;
    await render(
      <LocaleProvider deviceLanguage="en" getSessionId={() => sessionId}>
        <Probe />
      </LocaleProvider>,
    );

    await act(async () => {
      switchTo('pl', 'server', 1);
      sessionId = 2;
    });

    expect(screen.queryByText('Cześć')).toBeNull();
  });
});
