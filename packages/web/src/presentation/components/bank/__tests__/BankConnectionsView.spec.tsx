import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import type { BankConnection } from '../../../../infrastructure/api/BankConnectionMapper.js';
import { BankConnectionsView, type BankConnectionsViewProps } from '../BankConnectionsView.js';

const NOW = new Date('2026-10-27T12:00:00.000Z');

function connection(overrides: Partial<BankConnection>): BankConnection {
  return {
    id: 'conn-pko',
    bankId: 'PKO_BPKOPLPW',
    provider: 'gocardless',
    status: 'active',
    expiresAt: new Date('2027-01-20T00:00:00.000Z'),
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  };
}

function props(overrides: Partial<BankConnectionsViewProps> = {}): BankConnectionsViewProps {
  return {
    connections: [connection({})],
    loading: false,
    error: false,
    actionError: null,
    refreshingIds: [],
    now: NOW,
    onAddConnection: vi.fn(),
    onReconnect: vi.fn(),
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function card(bankId: string): HTMLElement {
  const item = screen.getByRole('heading', { name: bankId }).closest('li');
  if (item === null) {
    throw new Error(`no card for ${bankId}`);
  }

  return item;
}

describe('BankConnectionsView', () => {
  it('shows a connected card with its expiry date and no renewal action', () => {
    renderWithProviders(<BankConnectionsView {...props()} />);

    const pko = within(card('PKO_BPKOPLPW'));
    expect(pko.getByText('Connected')).toBeInTheDocument();
    expect(pko.getByText(/Access valid until/)).toBeInTheDocument();
    expect(pko.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows every consent state in words with a renew chip where access needs renewing', () => {
    renderWithProviders(
      <BankConnectionsView
        {...props({
          connections: [
            connection({
              id: 'a',
              bankId: 'EXPIRING',
              expiresAt: new Date('2026-10-30T00:00:00.000Z'),
            }),
            connection({ id: 'b', bankId: 'EXPIRED', status: 'expired' }),
            connection({ id: 'c', bankId: 'RECONNECT', status: 'reconnect_required' }),
            connection({ id: 'd', bankId: 'GONE', status: 'disconnected', expiresAt: null }),
          ],
        })}
      />,
    );

    expect(within(card('EXPIRING')).getByText('Renewal due')).toBeInTheDocument();
    expect(within(card('EXPIRING')).getByText(/3 days left/)).toBeInTheDocument();
    expect(within(card('EXPIRED')).getByText('Access ended')).toBeInTheDocument();
    expect(within(card('RECONNECT')).getByText('Reconnect needed')).toBeInTheDocument();
    expect(within(card('EXPIRING')).getByText('Renew bank access')).toBeInTheDocument();
    expect(within(card('GONE')).getByText('Disconnected')).toBeInTheDocument();
    expect(within(card('GONE')).getByText('Bank data is out of date')).toBeInTheDocument();
    expect(within(card('GONE')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('reconnects and refreshes the connection of the card', () => {
    const onReconnect = vi.fn();
    const onRefresh = vi.fn();
    renderWithProviders(
      <BankConnectionsView
        {...props({
          connections: [connection({ id: 'conn-ing', bankId: 'ING', status: 'expired' })],
          onReconnect,
          onRefresh,
        })}
      />,
    );

    fireEvent.click(within(card('ING')).getByRole('button', { name: 'Reconnect' }));
    fireEvent.click(within(card('ING')).getByRole('button', { name: 'Refresh now' }));

    expect(onReconnect).toHaveBeenCalledWith('conn-ing');
    expect(onRefresh).toHaveBeenCalledWith('conn-ing');
  });

  it('shows the updating chip while a refresh is in flight', () => {
    renderWithProviders(<BankConnectionsView {...props({ refreshingIds: ['conn-pko'] })} />);

    expect(within(card('PKO_BPKOPLPW')).getByText('Updating…')).toBeInTheDocument();
  });

  it('warns about a failed sync and offers the reconnect of that bank', () => {
    const onReconnect = vi.fn();
    renderWithProviders(
      <BankConnectionsView
        {...props({
          connections: [
            connection({ id: 'conn-sant', bankId: 'SANT', status: 'reconnect_required' }),
          ],
          onReconnect,
        })}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Bank sync failed for SANT');
    fireEvent.click(within(alert).getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalledWith('conn-sant');

    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns that access ends soon', () => {
    renderWithProviders(
      <BankConnectionsView
        {...props({
          connections: [
            connection({ bankId: 'MBANK', expiresAt: new Date('2026-10-30T00:00:00.000Z') }),
          ],
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Bank access for MBANK ends in 3 days');
  });

  it('offers the connect action when there are no connections', () => {
    const onAddConnection = vi.fn();
    renderWithProviders(<BankConnectionsView {...props({ connections: [], onAddConnection })} />);

    expect(screen.getByText('No bank connections yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect a bank' }));
    expect(onAddConnection).toHaveBeenCalledTimes(1);
  });

  it('shows a load error with retry, and an action error above the cards', () => {
    const onRetry = vi.fn();
    const { unmount } = renderWithProviders(
      <BankConnectionsView {...props({ connections: [], error: true, onRetry })} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load bank connections');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();

    renderWithProviders(<BankConnectionsView {...props({ actionError: 'reconnect' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start the reconnect');
    expect(screen.getByRole('heading', { name: 'PKO_BPKOPLPW' })).toBeInTheDocument();
  });
});
