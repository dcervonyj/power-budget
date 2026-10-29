import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Sheet } from '../Sheet.js';
import { Modal } from '../../../components/Modal.js';
import { Drawer } from '../../../components/Drawer.js';
import { Toast } from '../../../components/shared/Toast.js';
import { ErrorBanner } from '../../../components/shared/ErrorBanner.js';
import { EmptyState } from '../../../components/shared/EmptyState.js';
import { SkeletonList } from '../../../components/shared/SkeletonList.js';

function withIntl(node: React.ReactNode): React.JSX.Element {
  return (
    <IntlProvider locale="en" messages={{}} onError={() => undefined}>
      {node}
    </IntlProvider>
  );
}

function mockViewport(compact: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width') ? compact : query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(withIntl(<Sheet isOpen={false} onClose={vi.fn()} title="T" children="x" />));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a side sheet on desktop and a bottom sheet at 820 px and below', () => {
    mockViewport(false);
    const desktop = render(withIntl(<Sheet isOpen onClose={vi.fn()} title="T" children="x" />));

    expect(screen.getByRole('dialog').className).toContain('pbg-sheet-side');
    desktop.unmount();

    mockViewport(true);
    render(withIntl(<Sheet isOpen onClose={vi.fn()} title="T" children="x" />));

    expect(screen.getByRole('dialog').className).toContain('pbg-sheet-bottom');
  });

  it('is labelled by its title and closes on Esc, scrim click and the close button', () => {
    const onClose = vi.fn();
    render(withIntl(<Sheet isOpen onClose={onClose} title="Edit" children="x" />));

    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Close'));
    const backdrop = screen.getByRole('dialog').parentElement;
    if (backdrop === null) {
      throw new Error('expected a backdrop');
    }
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('traps focus and restores it to the opener on close', () => {
    function Harness({ open }: { open: boolean }): React.JSX.Element {
      return withIntl(
        <>
          <button type="button">opener</button>
          <Sheet isOpen={open} onClose={vi.fn()} title="T">
            <button type="button">inside</button>
          </Sheet>
        </>,
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByText('opener').focus();
    rerender(<Harness open />);

    const close = screen.getByLabelText('Close');
    const inside = screen.getByText('inside');
    expect(document.activeElement).toBe(close);

    inside.focus();
    fireEvent.keyDown(inside, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(inside);

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(screen.getByText('opener'));
  });
});

describe('Modal and Drawer', () => {
  it('Modal closes on Esc and moves focus into the dialog', () => {
    const onClose = vi.fn();
    render(withIntl(<Modal title="M" isOpen onClose={onClose} children="x" />));

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Drawer is a labelled dialog when open and absent when closed', () => {
    const { rerender } = render(
      withIntl(<Drawer isOpen onClose={vi.fn()} title="D" children="x" />),
    );

    expect(screen.getByRole('dialog', { name: 'D' })).toBeInTheDocument();
    rerender(withIntl(<Drawer isOpen={false} onClose={vi.fn()} title="D" children="x" />));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Modal focus', () => {
  it('wraps Tab and Shift+Tab, restores focus, and survives a re-render with a new onClose', () => {
    function Harness({ open, tick }: { open: boolean; tick: number }): React.JSX.Element {
      return withIntl(
        <>
          <button type="button">opener</button>
          <Modal title={`M${String(tick)}`} isOpen={open} onClose={() => undefined}>
            <button type="button">inside</button>
          </Modal>
        </>,
      );
    }
    const { rerender } = render(<Harness open={false} tick={0} />);
    screen.getByText('opener').focus();
    rerender(<Harness open tick={0} />);
    const close = screen.getByLabelText('Close');
    const inside = screen.getByText('inside');
    expect(document.activeElement).toBe(close);

    inside.focus();
    rerender(<Harness open tick={1} />);
    expect(document.activeElement).toBe(inside);

    fireEvent.keyDown(inside, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(inside);

    rerender(<Harness open={false} tick={1} />);
    expect(document.activeElement).toBe(screen.getByText('opener'));
  });

  it('closes only the topmost of stacked overlays on Esc', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Stack({ innerOpen }: { innerOpen: boolean }): React.JSX.Element {
      return withIntl(
        <Modal title="outer" isOpen onClose={outer}>
          <Modal title="inner" isOpen={innerOpen} onClose={inner}>
            x
          </Modal>
        </Modal>,
      );
    }
    const { rerender } = render(<Stack innerOpen={false} />);
    rerender(<Stack innerOpen />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('portals to body and labels an untitled drawer without an empty heading', () => {
    render(withIntl(<Drawer isOpen onClose={vi.fn()} children="x" />));

    expect(screen.getByRole('dialog').parentElement?.parentElement).toBe(document.body);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('shows the message and dismisses on button and after the timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(withIntl(<Toast message="Saved" onDismiss={onDismiss} />));

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('renders nothing without a message', () => {
    const { container } = render(withIntl(<Toast message={null} onDismiss={vi.fn()} />));

    expect(container).toBeEmptyDOMElement();
  });
});

describe('states', () => {
  it('ErrorBanner carries an icon and the word Error next to the message', () => {
    render(withIntl(<ErrorBanner message="Load failed" />));
    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent('Error');
    expect(alert).toHaveTextContent('Load failed');
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('EmptyState action fires', () => {
    const onPress = vi.fn();
    render(
      withIntl(
        <EmptyState title="Nothing" subtitle="Add one" action={{ label: 'Add', onPress }} />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it('SkeletonList announces loading and hides its blocks', () => {
    const { container } = render(withIntl(<SkeletonList rows={2} />));

    expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"].pbg-skeleton')).toHaveLength(2);
  });
});
