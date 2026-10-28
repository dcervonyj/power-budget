import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { ClonePlanModal } from '../../../components/ClonePlanModal.js';
import { referenceCatalogue } from '../../../../application/catalogue/catalogueInstance.js';
import { plansApi } from '../../../../AppProviders.js';
import { darkTheme } from '@power-budget/design-tokens';

vi.mock('../../../../AppProviders.js', () => ({
  plansApi: { clone: vi.fn(), list: vi.fn(), get: vi.fn(), listItems: vi.fn() },
  categoriesApi: { list: vi.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

describe('ClonePlanModal', () => {
  beforeEach(() => {
    vi.mocked(plansApi.clone).mockReset();
    referenceCatalogue.invalidate();
  });

  it('invalidates the cached reference data after a clone, so the clone shows in the mapping modals', async () => {
    vi.mocked(plansApi.clone).mockResolvedValue(undefined as never);
    const onCloned = vi.fn();
    const before = referenceCatalogue.version;
    render(<ClonePlanModal isOpen planId="plan-1" onClose={vi.fn()} onCloned={onCloned} />, {
      wrapper,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

    await waitFor(() => expect(onCloned).toHaveBeenCalledOnce());
    expect(referenceCatalogue.version).toBe(before + 1);
  });

  it('keeps the cache when the clone fails', async () => {
    vi.mocked(plansApi.clone).mockRejectedValue(new Error('no'));
    const before = referenceCatalogue.version;
    render(<ClonePlanModal isOpen planId="plan-1" onClose={vi.fn()} onCloned={vi.fn()} />, {
      wrapper,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

    await screen.findByText('Failed to clone plan');
    expect(referenceCatalogue.version).toBe(before);
  });
});
