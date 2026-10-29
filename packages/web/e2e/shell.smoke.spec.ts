import { test, expect, type Page, type Route } from '@playwright/test';
import { FULL_STACK, STACK } from './support/stack.js';

// DSN-017: the app shell (header nav, bottom tab bar, account menu) and the auth layout against a
// stubbed API, so they run without a backend (tagged @smoke; skipped when no dev server answers).

const API = FULL_STACK ? STACK.apiUrl : (process.env['VITE_API_URL'] ?? 'http://localhost:3000');

const PROFILE = {
  id: 'user-anna',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  locale: 'en',
  localePreference: 'en',
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  onboardingCompleted: true,
  householdId: 'hh-1',
};

const MEMBERS = [
  {
    userId: 'user-anna',
    email: 'anna@example.com',
    displayName: 'Anna Kowalska',
    role: 'owner',
    joinedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    userId: 'user-marek',
    email: 'marek@example.com',
    displayName: 'Marek Nowak',
    role: 'member',
    joinedAt: '2026-10-02T10:00:00.000Z',
  },
];

function unmapped(id: string): Record<string, unknown> {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-22',
    amount: { amountMinor: '-1890', currency: 'PLN' },
    description: 'Żabka',
    merchant: null,
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-22T12:49:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
  };
}

async function stubApi(page: Page): Promise<void> {
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });

      return;
    }
    const url = new URL(request.url());
    const json = (status: number, body: unknown): Promise<void> =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    switch (`${request.method()} ${url.pathname}`) {
      case 'GET /users/me':
        return json(200, PROFILE);
      case 'GET /households/members':
        return json(200, MEMBERS);
      case 'GET /transactions':
        return json(200, {
          items: [unmapped('tx-1'), unmapped('tx-2'), unmapped('tx-3')],
          nextCursor: null,
          hasMore: false,
        });
      case 'GET /plans':
        return json(200, []);
      case 'GET /bank-connections':
        return json(200, []);
      default:
        return json(404, { statusCode: 404, code: 'not_found' });
    }
  });
}

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('pb_shell_seeded')) {
      sessionStorage.setItem('pb_shell_seeded', '1');
      localStorage.setItem('pb_access_token', 'smoke-access');
      localStorage.setItem('pb_refresh_token', 'smoke-refresh');
      localStorage.setItem('pb_locale', 'en');
    }
  });
}

async function open(page: Page, url: string): Promise<boolean> {
  try {
    const response = await page.goto(url);

    return response !== null && response.status() < 500;
  } catch {
    return false;
  }
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('DSN-017 app shell', () => {
  test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('compact header, bottom tab bar and no horizontal scroll @smoke', async ({ page }) => {
      await signIn(page);
      await stubApi(page);
      if (!(await open(page, '/dashboard'))) {
        test.skip(true, 'Dev server not running');

        return;
      }

      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('main')).toBeVisible();
      const tabs = page.getByRole('navigation', { name: 'Main' });
      await expect(tabs).toHaveCount(1);
      await expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(tabs.getByRole('link', { name: '3 to sort' })).toBeVisible();
      await expect(page.getByText('No active budget plan')).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('the auth layout has no horizontal scroll @smoke', async ({ page }) => {
      if (!(await open(page, '/login'))) {
        test.skip(true, 'Dev server not running');

        return;
      }

      await expect(page.getByRole('main').locator('form')).toBeVisible();
      await expect(page.getByLabel('Language')).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  });

  test('header nav and a keyboard-operable account menu at 1440 px @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await stubApi(page);
    if (!(await open(page, '/plans'))) {
      test.skip(true, 'Dev server not running');

      return;
    }

    const nav = page.getByRole('banner').getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: '3 to sort' })).toBeVisible();

    const menuButton = page.getByRole('button', { name: /Account and settings/ });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Account' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Categories' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    await page.keyboard.press('Enter');
    await menu.getByRole('link', { name: 'Household' }).click();
    await expect(page).toHaveURL(/\/household$/);
    await expect(page.getByRole('banner')).toBeVisible();
  });
});
