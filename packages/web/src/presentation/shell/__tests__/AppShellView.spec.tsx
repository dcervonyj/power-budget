import { createMock } from '@golevelup/ts-vitest';
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REDUCED_MOTION_QUERY } from '../../theme/themePreference.js';
import { stubMatchMedia } from '../../theme/__tests__/matchMediaStub.js';
import type { AccountMenuProps } from '../AccountMenu.js';
import { AppShellView, SHELL_COMPACT_QUERY, type AppShellViewProps } from '../AppShellView.js';

function account(overrides: Partial<AccountMenuProps> = {}): AccountMenuProps {
  return createMock<AccountMenuProps>({
    me: { userId: 'user-anna', name: 'Anna Kowalska' },
    partner: { userId: 'user-marek', name: 'Marek Nowak' },
    themePreference: 'system',
    onThemeChange: vi.fn(),
    locale: 'en',
    onLocaleChange: vi.fn(),
    onSignOut: vi.fn(),
    signingOut: false,
    ...overrides,
  });
}

function props(overrides: Partial<AppShellViewProps> = {}): AppShellViewProps {
  return {
    active: 'overview',
    toSortCount: 3,
    syncChips: [{ key: 'own', state: { kind: 'bank-age', ageMinutes: 25 }, viewer: 'owner' }],
    account: account(),
    children: <p>screen content</p>,
    ...overrides,
  };
}

function renderShell(overrides: Partial<AppShellViewProps> = {}): void {
  render(
    <IntlProvider locale="en" messages={{}} onError={ignore}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AppShellView {...props(overrides)} />} />
          <Route path="/categories" element={<p>categories-route</p>} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

function ignore(): void {
  // Tests render the default messages.
}

function useCompactLayout(): void {
  stubMatchMedia({ [SHELL_COMPACT_QUERY]: true, [REDUCED_MOTION_QUERY]: true });
}

function menuButton(): HTMLElement {
  return screen.getByRole('button', { name: /Account and settings/ });
}

describe('AppShellView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('landmarks', () => {
    it('has a banner with the main nav and the screen in main', () => {
      renderShell();

      const banner = screen.getByRole('banner');
      const nav = within(banner).getByRole('navigation', { name: 'Main' });
      expect(
        within(nav)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Overview', 'Transactions', 'Plan']);
      expect(within(screen.getByRole('main')).getByText('screen content')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
        'href',
        '#main-content',
      );
    });

    it('moves the nav to a bottom tab bar at 820 px and below', () => {
      useCompactLayout();
      renderShell();

      expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
      const tabBar = screen.getByRole('navigation', { name: 'Main' });
      expect(within(screen.getByRole('banner')).queryByRole('navigation')).toBeNull();
      expect(
        within(tabBar)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['/dashboard', '/transactions', '/transactions?status=unmapped', '/plans']);
    });
  });

  describe('active item', () => {
    it('marks the current destination in the header', () => {
      renderShell({ active: 'plan' });

      expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    });

    it('marks Transactions in the header and To sort in the tab bar for the to-sort list', () => {
      renderShell({ active: 'toSort' });

      expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: '3 to sort' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('marks the To sort tab on a narrow screen', () => {
      useCompactLayout();
      renderShell({ active: 'toSort' });

      expect(screen.getByRole('link', { name: '3 To sort' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: 'Transactions' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('marks nothing on an account page', () => {
      renderShell({ active: null });

      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(within(nav).queryByRole('link', { current: 'page' })).toBeNull();
    });
  });

  describe('to-sort badge', () => {
    it('links the count to the to-sort list', () => {
      renderShell({ toSortCount: 3 });

      const link = screen.getByRole('link', { name: '3 to sort' });
      expect(link).toHaveAttribute('href', '/transactions?status=unmapped');
      expect(link).toHaveTextContent('3 to sort');
    });

    it('uses the singular for one', () => {
      renderShell({ toSortCount: 1 });

      expect(screen.getByRole('link', { name: '1 to sort' })).toHaveTextContent('1 to sort');
    });

    it('caps the badge at 99+', () => {
      renderShell({ toSortCount: 101 });

      expect(screen.getByRole('link', { name: '99+ to sort' })).toHaveTextContent('99+ to sort');
    });

    it.each([0, null])('shows no badge for %s', (toSortCount) => {
      renderShell({ toSortCount });

      expect(screen.queryByRole('link', { name: /to sort/i })).toBeNull();
    });

    it('puts the badge on the To sort tab on a narrow screen', () => {
      useCompactLayout();
      renderShell({ toSortCount: 3 });

      const tab = screen.getByRole('link', { name: '3 To sort' });
      expect(tab).toHaveTextContent('3 To sort');
    });
  });

  describe('sync chips', () => {
    it('shows the own bank sync in words', () => {
      renderShell();

      const group = screen.getByRole('group', { name: 'Bank sync' });
      expect(group).toHaveTextContent('Your bank updated 25 minutes ago');
    });

    it('makes a renew chip a button', () => {
      const onPress = vi.fn();
      renderShell({
        syncChips: [{ key: 'own', state: { kind: 'renew' }, viewer: 'owner', onPress }],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Renew bank access' }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders no group without chips', () => {
      renderShell({ syncChips: [] });

      expect(screen.queryByRole('group', { name: 'Bank sync' })).toBeNull();
    });
  });

  describe('account menu', () => {
    it('shows you and your partner on the closed button', () => {
      renderShell();

      const button = menuButton();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(within(button).getByRole('img', { name: 'Anna Kowalska' })).toBeInTheDocument();
      expect(within(button).getByRole('img', { name: 'Marek Nowak' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Account' })).toBeNull();
    });

    it('opens from the keyboard, moves focus in and closes on Esc back to the button', () => {
      renderShell();
      const button = menuButton();
      button.focus();

      fireEvent.click(button);

      const dialog = screen.getByRole('dialog', { name: 'Account' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', dialog.id);
      expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: 'Categories' }));
      expect(
        within(dialog)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['/categories', '/household', '/bank-connections', '/settings', '/audit']);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(document.activeElement).toBe(button);
    });

    it('keeps Tab inside the open menu', () => {
      renderShell();
      fireEvent.click(menuButton());
      const dialog = screen.getByRole('dialog', { name: 'Account' });
      const signOut = within(dialog).getByRole('button', { name: 'Sign out' });
      signOut.focus();

      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: 'Categories' }));
    });

    it('changes the theme, the language and signs out', () => {
      const menu = account();
      renderShell({ account: menu });
      fireEvent.click(menuButton());

      fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
      fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'pl' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

      expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument();
      expect(menu.onThemeChange).toHaveBeenCalledWith('dark');
      expect(menu.onLocaleChange).toHaveBeenCalledWith('pl');
      expect(menu.onSignOut).toHaveBeenCalledTimes(1);
    });

    it('shows the sign-out progress', () => {
      renderShell({ account: account({ signingOut: true }) });
      fireEvent.click(menuButton());

      expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    });

    it('navigates and closes when a link is chosen', () => {
      renderShell();
      fireEvent.click(menuButton());

      fireEvent.click(screen.getByRole('link', { name: 'Categories' }));

      expect(screen.getByText('categories-route')).toBeInTheDocument();
    });

    it('closes on a click outside', () => {
      renderShell();
      fireEvent.click(menuButton());

      act(() => {
        fireEvent.mouseDown(screen.getByText('screen content'));
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows a generic mark while the profile is unknown', () => {
      renderShell({ account: account({ me: null, partner: null }) });

      expect(within(menuButton()).queryByRole('img')).toBeNull();
      fireEvent.click(menuButton());
      expect(screen.getByRole('dialog', { name: 'Account' })).not.toHaveTextContent('Anna');
    });
  });
});
