import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../theme/index.js';
import { Modal } from '../../../components/Modal.js';
import { EmptyState } from '../EmptyState.js';
import { ErrorBanner } from '../ErrorBanner.js';
import { Sheet } from '../Sheet.js';
import { Skeleton } from '../Skeleton.js';
import { TOAST_DISMISS_MS, ToastProvider, useToast } from '../Toast.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

function renderThemed(ui: React.ReactElement): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" defaultLocale="en">
        {ui}
      </IntlProvider>
    </ThemeProvider>,
  );
}

async function dragHeader(deltaY: number, elapsedMs: number): Promise<void> {
  const header = screen.getByTestId('sheet-header');
  await fireEvent(header, 'responderGrant', { nativeEvent: { pageY: 100 }, timeStamp: 1000 });
  await fireEvent(header, 'responderMove', {
    nativeEvent: { pageY: 100 + deltaY },
    timeStamp: 1010,
  });
  await fireEvent(header, 'responderRelease', {
    nativeEvent: { pageY: 100 + deltaY },
    timeStamp: 1000 + elapsedMs,
  });
}

describe('Sheet', () => {
  it('renders the title as a header and the content when open', async () => {
    await renderThemed(
      <Sheet isOpen onClose={jest.fn()} title="Edit category">
        <Text>sheet body</Text>
      </Sheet>,
    );

    expect(screen.getByRole('header', { name: 'Edit category' })).toBeTruthy();
    expect(screen.getByText('sheet body')).toBeTruthy();
  });

  it('renders nothing while closed and unmounts after closing', async () => {
    const view = await renderThemed(
      <Sheet isOpen title="Edit category" onClose={jest.fn()}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    await view.rerender(
      <ThemeProvider>
        <IntlProvider locale="en" defaultLocale="en">
          <Sheet isOpen={false} title="Edit category" onClose={jest.fn()}>
            <Text>sheet body</Text>
          </Sheet>
        </IntlProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('sheet body')).toBeNull();
    });
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet isOpen title="Edit category" onClose={onClose}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the hardware back button and Esc (onRequestClose)', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet isOpen title="Edit category" onClose={onClose}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    await fireEvent(screen.getByTestId('sheet-header'), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the header is dragged past the threshold', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet isOpen title="Edit category" onClose={onClose}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    await dragHeader(140, 400);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back when the gesture is terminated and ignores a second close while leaving', async () => {
    const onClose = jest.fn();
    const view = await renderThemed(
      <Sheet isOpen title="Edit category" onClose={onClose}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    const header = screen.getByTestId('sheet-header');
    await fireEvent(header, 'responderGrant', { nativeEvent: { pageY: 100 }, timeStamp: 0 });
    await fireEvent(header, 'responderMove', { nativeEvent: { pageY: 160 }, timeStamp: 10 });
    await fireEvent(header, 'responderTerminate');

    expect(onClose).not.toHaveBeenCalled();
    await view.rerender(
      <ThemeProvider>
        <IntlProvider locale="en" defaultLocale="en">
          <Sheet isOpen={false} title="Edit category" onClose={onClose}>
            <Text>sheet body</Text>
          </Sheet>
        </IntlProvider>
      </ThemeProvider>,
    );
    const close = screen.queryByRole('button', { name: 'Close' });
    if (close !== null) {
      await userEvent.setup().press(close);
    }

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open on a short, slow drag or an upward drag', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet isOpen title="Edit category" onClose={onClose}>
        <Text>sheet body</Text>
      </Sheet>,
    );
    await dragHeader(30, 600);
    await dragHeader(-200, 100);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal as a sheet', () => {
  it('keeps its props: title, footer buttons, onClose', async () => {
    const onClose = jest.fn();
    const onDelete = jest.fn();
    await renderThemed(
      <Modal
        isOpen
        title="Delete this plan?"
        onClose={onClose}
        footerButtons={[
          { label: 'Cancel', variant: 'secondary', onPress: onClose },
          { label: 'Delete', variant: 'danger', onPress: onDelete },
        ]}
      >
        <Text>modal body</Text>
      </Modal>,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Delete' }));
    await user.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('header', { name: 'Delete this plan?' })).toBeTruthy();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function ToastTrigger(): React.JSX.Element {
  const toast = useToast();

  return (
    <Text
      onPress={() => {
        toast.show('Saved');
      }}
    >
      trigger
    </Text>
  );
}

describe('Toast', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a message as a polite live region, dismisses on press and by itself', async () => {
    jest.useFakeTimers();
    await renderThemed(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByText('trigger'));

    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Saved')).toBeNull();

    await fireEvent.press(screen.getByText('trigger'));
    await act(async () => {
      jest.advanceTimersByTime(TOAST_DISMISS_MS);
    });

    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('throws outside a provider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(render(<ToastTrigger />)).rejects.toThrow('ToastProvider');
    consoleError.mockRestore();
  });
});

describe('ErrorBanner', () => {
  it('is one assertive alert with the word Error, the message and a retry', async () => {
    const onRetry = jest.fn();
    await renderThemed(<ErrorBanner message="Could not load." onRetry={onRetry} />);
    const alert = screen.getByRole('alert');

    expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Could not load.')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no retry button without onRetry', async () => {
    await renderThemed(<ErrorBanner message="Network error" />);

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('EmptyState', () => {
  it('shows title, subtitle and one action', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <EmptyState
        title="No transactions yet"
        subtitle="Add one by hand."
        action={{ label: 'Add account', onPress }}
      />,
    );
    await userEvent.setup().press(screen.getByRole('button', { name: 'Add account' }));

    expect(screen.getByRole('header', { name: 'No transactions yet' })).toBeTruthy();
    expect(screen.getByText('Add one by hand.')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton', () => {
  it('is hidden from screen readers and static under reduced motion', async () => {
    await renderThemed(<Skeleton height={40} />);
    const block = screen.getByTestId('skeleton', { includeHiddenElements: true });

    expect(block.props.accessibilityElementsHidden).toBe(true);
    expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toHaveStyle({
      opacity: 0.55,
    });
  });
});
