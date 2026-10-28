import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AuditEventDto, AuditPageDto } from '@power-budget/shared-app/contract';
import { settingsStore } from '../../../../composition.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { AuditLogScreen } from '../AuditLogScreen.js';

const apiSpies = spyOnApiClient();
const mockGet = apiSpies.get;
const loadProfile = vi.spyOn(settingsStore, 'loadProfile');

function event(id: string, action: string): AuditEventDto {
  return {
    id,
    householdId: 'hh-1',
    subjectType: 'Plan',
    subjectId: 'p1',
    actorId: 'user-1',
    action,
    occurredAt: '2026-10-12T09:30:00.000Z',
    meta: {},
  };
}

function page(data: AuditPageDto): {
  status: number;
  data: AuditPageDto;
  headers: Record<string, string>;
} {
  return { status: 200, data, headers: {} };
}

describe('AuditLogScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadProfile.mockResolvedValue(undefined);
    settingsStore.profileLoaded = true;
    settingsStore.userId = 'user-1';
  });

  it('loads the next page with the cursor and appends it', async () => {
    mockGet
      .mockResolvedValueOnce(
        page({ items: [event('e1', 'plan.created')], nextCursor: 'c1', hasMore: true }),
      )
      .mockResolvedValueOnce(
        page({ items: [event('e2', 'plan.updated')], nextCursor: null, hasMore: false }),
      );
    renderWithProviders(<AuditLogScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('plan.updated')).toBeInTheDocument();
    expect(screen.getByText('plan.created')).toBeInTheDocument();
    expect(mockGet).toHaveBeenLastCalledWith('/audit-log?cursor=c1');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows a separate error when load more fails, keeps the events, and retry works', async () => {
    mockGet
      .mockResolvedValueOnce(
        page({ items: [event('e1', 'plan.created')], nextCursor: 'c1', hasMore: true }),
      )
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        page({ items: [event('e2', 'plan.updated')], nextCursor: null, hasMore: false }),
      );
    renderWithProviders(<AuditLogScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load more events');
    expect(screen.getByText('plan.created')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('plan.updated')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('shows the load error, not the empty state, when the first page fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<AuditLogScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the audit log');
    expect(screen.queryByText('No audit events')).toBeNull();
  });
});
