import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { SettingsDataTab } from '../SettingsDataTab.js';

const store = vi.hoisted(() => ({
  isExporting: false,
  exportUrl: null,
  exportError: null,
  isDeleting: false,
  deleteError: null as string | null,
  deletionScheduledFor: null as string | null,
  deleteAccount: vi.fn(),
  clearExportUrl: vi.fn(),
  exportData: vi.fn(),
}));

vi.mock('../../../../application/settings/SettingsStore.js', () => ({ settingsStore: store }));

function openAndConfirm(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
    target: { value: 'DELETE' },
  });
  const buttons = screen.getAllByRole('button', { name: 'Delete account' });
  fireEvent.click(buttons[buttons.length - 1] ?? document.body);
}

describe('SettingsDataTab household deletion feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.deleteError = null;
    store.deletionScheduledFor = null;
    store.isDeleting = false;
  });

  it('keeps the dialog open and shows the scheduled date once deletion is scheduled', () => {
    store.deletionScheduledFor = '2026-11-27T10:00:00.000Z';
    renderWithProviders(<SettingsDataTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(screen.getByRole('status')).toHaveTextContent('Deletion is scheduled.');
    expect(screen.getByRole('status')).toHaveTextContent('November 27, 2026');
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });

  it('sends the delete request once and ignores clicks while it runs', () => {
    renderWithProviders(<SettingsDataTab />);

    openAndConfirm();
    expect(store.deleteAccount).toHaveBeenCalledTimes(1);
    expect(store.deleteAccount).toHaveBeenCalledWith('');
  });

  it('does not send another request while one is running', () => {
    store.isDeleting = true;
    renderWithProviders(<SettingsDataTab />);

    openAndConfirm();

    expect(store.deleteAccount).not.toHaveBeenCalled();
  });

  it('shows the owner-only error text when the store reports it', () => {
    store.deleteError = 'household_owner_required';
    renderWithProviders(<SettingsDataTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only the household owner can delete the household.',
    );
  });
});
