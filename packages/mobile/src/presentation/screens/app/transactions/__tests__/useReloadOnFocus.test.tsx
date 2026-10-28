import React from 'react';
import { render } from '@testing-library/react-native';
import { useReloadOnFocus } from '../useReloadOnFocus.js';
import type { FocusEvents } from '../useReloadOnFocus.js';

function Probe({
  navigation,
  reload,
}: {
  readonly navigation: FocusEvents;
  readonly reload: () => void;
}): null {
  useReloadOnFocus(navigation, reload);

  return null;
}

function fakeNavigation(): { navigation: FocusEvents; focus: () => void; listeners: () => number } {
  const registered = new Set<() => void>();
  const navigation: FocusEvents = {
    addListener(_type, listener) {
      registered.add(listener);

      return () => registered.delete(listener);
    },
  };

  return {
    navigation,
    focus: () => registered.forEach((listener) => listener()),
    listeners: () => registered.size,
  };
}

describe('useReloadOnFocus', () => {
  it('reloads every time the screen gets focus again', async () => {
    const reload = jest.fn();
    const { navigation, focus } = fakeNavigation();
    await render(<Probe navigation={navigation} reload={reload} />);

    focus();
    focus();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('stops listening on unmount', async () => {
    const { navigation, listeners } = fakeNavigation();
    const view = await render(<Probe navigation={navigation} reload={jest.fn()} />);

    expect(listeners()).toBe(1);
    await view.unmount();

    expect(listeners()).toBe(0);
  });
});
