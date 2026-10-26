import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { GalleryApp } from '../GalleryApp.js';
import { buildGalleryEntries } from '../registry.js';
import * as tokensGallery from '../Tokens.gallery.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-font', () => ({ useFonts: (): [boolean, Error | null] => [true, null] }));
jest.mock('../../presentation/theme/fonts.js', () => ({ GEIST_FONTS: {} }));

const entries = buildGalleryEntries({ '../gallery/Tokens.gallery.tsx': { ...tokensGallery } });

describe('GalleryApp', () => {
  it.each(['dark', 'light'] as const)('renders the sample entry in the %s theme', async (theme) => {
    await render(
      <GalleryApp
        params={{ entry: 'Tokens/Swatches', theme }}
        entries={entries}
        onNavigate={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Token swatches')).toBeTruthy());
    expect(screen.getByText('accent')).toBeTruthy();
    expect(screen.queryByText('Type scale')).toBeNull();
  });

  it('renders the type scale entry', async () => {
    await render(
      <GalleryApp
        params={{ entry: 'Tokens/TypeScale', theme: 'dark' }}
        entries={entries}
        onNavigate={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Type scale')).toBeTruthy());
    expect(screen.getByText('display')).toBeTruthy();
  });

  it('lists every entry in the index and navigates with the chosen theme', async () => {
    const onNavigate = jest.fn();
    await render(
      <GalleryApp
        params={{ entry: null, theme: 'dark' }}
        entries={entries}
        onNavigate={onNavigate}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('gallery-index')).toBeTruthy());
    expect(screen.getByText('Tokens/Swatches')).toBeTruthy();
    expect(screen.getByText('Tokens/TypeScale')).toBeTruthy();

    const user = userEvent.setup();
    await user.press(screen.getAllByText('light')[0]!);

    expect(onNavigate).toHaveBeenCalledWith({ entry: 'Tokens/Swatches', theme: 'light' });
  });
});
