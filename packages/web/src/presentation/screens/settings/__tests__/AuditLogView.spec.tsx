import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { AuditEventDto } from '@power-budget/shared-app/contract';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { AuditLogView, type AuditLogViewProps } from '../AuditLogView.js';

const EVENTS: readonly AuditEventDto[] = [
  {
    id: 'e1',
    householdId: 'hh-1',
    subjectType: 'Plan',
    subjectId: 'plan-oct',
    actorId: 'user-anna',
    action: 'plan.updated',
    occurredAt: '2026-10-12T09:30:00.000Z',
    meta: { planId: 'plan-oct' },
  },
  {
    id: 'e2',
    householdId: 'hh-1',
    subjectType: 'Transaction',
    subjectId: 'tx-1',
    actorId: 'user-marek',
    action: 'transaction.mapped',
    occurredAt: '2026-10-11T18:05:00.000Z',
    meta: {},
  },
];

function renderView(overrides: Partial<AuditLogViewProps> = {}): void {
  renderWithProviders(
    <AuditLogView
      events={EVENTS}
      loading={false}
      error={false}
      hasMore={false}
      loadingMore={false}
      loadMoreError={false}
      onLoadMore={vi.fn()}
      currentUserId="user-anna"
      onRetry={vi.fn()}
      {...overrides}
    />,
  );
}

describe('AuditLogView', () => {
  it('names the viewer as You and other actors as household members, with details only when present', () => {
    renderView();

    const items = screen.getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('You');
    expect(items[0]).toHaveTextContent('plan.updated');
    expect(items[0]).toHaveTextContent('Details: {"planId":"plan-oct"}');
    expect(items[1]).toHaveTextContent('Household member');
    expect(items[1]).not.toHaveTextContent('Details');
  });

  it('shows the empty state', () => {
    renderView({ events: [] });

    expect(screen.getByText('No audit events')).toBeInTheDocument();
  });

  it('shows a loading group while the log loads', () => {
    renderView({ loading: true, events: [] });

    expect(screen.getByRole('group', { name: 'Loading...' })).toBeInTheDocument();
    expect(screen.queryByText('No audit events')).toBeNull();
  });

  it('shows the error with a retry that calls back', () => {
    const onRetry = vi.fn();
    renderView({ error: true, events: [], onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the audit log');
    expect(screen.queryByText('No audit events')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers load more only when another page exists, and calls back', () => {
    const onLoadMore = vi.fn();
    renderView({ hasMore: true, onLoadMore });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('has no load more on the last page', () => {
    renderView({ hasMore: false });

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('keeps the events and shows a separate error with retry when a further page fails', () => {
    const onLoadMore = vi.fn();
    renderView({ hasMore: true, loadMoreError: true, onLoadMore });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load more events');
    expect(screen.queryByText('Failed to load the audit log')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
