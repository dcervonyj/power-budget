import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import { FULL_STACK, STACK } from './support/stack.js';

// UI-013: the plan dashboard, the household screen (invite partner) and the
// accept-invite page against a stubbed API, so they run without a backend. Tagged
// @smoke like smoke.spec.ts; they skip when no dev server answers. The full-stack
// versions live in household.spec.ts / plans.spec.ts (CLN-017, TEST_ENV=e2e).

// The API the web build talks to: the e2e backend on the stack, else the dev default.
const API = FULL_STACK ? STACK.apiUrl : (process.env['VITE_API_URL'] ?? 'http://localhost:3000');
const SCREENSHOT_DIR = process.env['UI013_SCREENSHOT_DIR'];

const plan = {
  id: 'plan-1',
  name: 'October',
  type: 'household',
  ownerUserId: 'user-ann',
  periodKind: 'monthly',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function pln(amountMinor: string): { amountMinor: string; currency: string } {
  return { amountMinor, currency: 'PLN' };
}

function line(
  plannedItemId: string,
  categoryId: string,
  direction: 'income' | 'expense',
  planned: string,
  actual: string,
  progressBand: 'ok' | 'warning' | 'over',
): Record<string, unknown> {
  return {
    plannedItemId,
    categoryId,
    direction,
    planned: pln(planned),
    actual: pln(actual),
    remaining: pln(String(BigInt(planned) - BigInt(actual))),
    progressBand,
  };
}

const dashboard = {
  planId: 'plan-1',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [line('i-salary', 'cat-salary', 'income', '1000000', '1000000', 'over')],
  expenseLines: [
    line('i-food', 'cat-groceries', 'expense', '150000', '100000', 'ok'),
    line('i-food-eur', 'cat-groceries', 'expense', '43000', '40000', 'warning'),
    line('i-rent', 'cat-rent', 'expense', '300000', '320000', 'over'),
  ],
  totalPlannedIncome: pln('1000000'),
  totalActualIncome: pln('1000000'),
  totalPlannedExpenses: pln('493000'),
  totalActualExpenses: pln('460000'),
  unplannedExpenses: pln('17824'),
  unplannedIncome: pln('0'),
  net: pln('522176'),
  asOf: '2026-10-21',
};

function category(
  id: string,
  name: string,
  kind: string,
  privacy: string,
): Record<string, unknown> {
  return {
    id,
    name,
    kind,
    icon: 'tag',
    color: '#6B7280',
    isSystem: false,
    seedKey: null,
    privacy,
    archived: false,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

const categories = [
  category('cat-salary', 'Salary', 'income', 'full_detail'),
  category('cat-groceries', 'Groceries', 'expense', 'total_only'),
  category('cat-rent', 'Rent', 'expense', 'full_detail'),
];

function item(
  id: string,
  categoryId: string,
  amountMinor: string,
  currency: string,
  note: string | null,
) {
  return {
    id,
    planId: 'plan-1',
    categoryId,
    direction: categoryId === 'cat-salary' ? 'income' : 'expense',
    amount: { amountMinor, currency },
    note,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const items = [
  item('i-salary', 'cat-salary', '1000000', 'PLN', null),
  item('i-food', 'cat-groceries', '150000', 'PLN', 'Weekly shop'),
  item('i-food-eur', 'cat-groceries', '10000', 'EUR', 'Wise card'),
  item('i-rent', 'cat-rent', '300000', 'PLN', null),
];

const unplannedExpenses = {
  items: [
    {
      id: 'tx-1',
      description: 'Allegro',
      amountMinor: '-12550',
      currency: 'PLN',
      occurredOn: '2026-10-12',
      accountId: 'acc-1',
      source: 'bank',
    },
    {
      id: 'tx-2',
      description: 'Wise card · Lidl Berlin',
      amountMinor: '-1240',
      currency: 'EUR',
      occurredOn: '2026-10-14',
      accountId: 'acc-2',
      source: 'bank',
    },
  ],
  nextCursor: null,
};

const ann = {
  userId: 'user-ann',
  email: 'ann@example.com',
  displayName: 'Ann',
  role: 'owner',
  joinedAt: '2026-10-01T10:00:00.000Z',
};

function profile(userId: string, email: string): Record<string, unknown> {
  return {
    id: userId,
    email,
    displayName: email.split('@')[0],
    locale: 'en',
    localePreference: 'en',
    defaultLocale: 'en',
    baseCurrency: 'PLN',
    timezone: 'Europe/Warsaw',
    householdId: 'hh-1',
  };
}

interface StubState {
  invites: Array<Record<string, unknown>>;
  posts: Array<{ url: string; body: unknown }>;
}

async function stubApi(page: Page, me: Record<string, unknown>): Promise<StubState> {
  const state: StubState = { invites: [], posts: [] };
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
    if (request.method() === 'POST') {
      state.posts.push({ url: url.pathname, body: request.postDataJSON() });
    }
    const key = `${request.method()} ${url.pathname}`;
    switch (key) {
      case 'GET /users/me':
        return json(200, me);
      case 'GET /plans':
        return json(200, [plan]);
      case 'GET /plans/plan-1':
        return json(200, plan);
      case 'GET /plans/plan-1/items':
        return json(200, items);
      case 'GET /plans/plan-1/dashboard':
        return json(200, dashboard);
      case 'GET /plans/plan-1/dashboard/unplanned':
        return json(
          200,
          url.searchParams.get('direction') === 'expense'
            ? unplannedExpenses
            : { items: [], nextCursor: null },
        );
      case 'GET /categories':
        return json(200, categories);
      case 'GET /bank-connections':
        return json(200, []);
      case 'GET /households/members':
        return json(200, [ann]);
      case 'GET /households/invites':
        return json(200, state.invites);
      case 'POST /households/invites': {
        const invite = {
          id: 'invite-1',
          email: 'bob@example.com',
          status: 'pending',
          expiresAt: '2026-10-28T12:00:00.000Z',
          createdAt: '2026-10-21T12:00:00.000Z',
        };
        state.invites = [invite];

        return json(201, invite);
      }
      case 'GET /households/hh-1/dashboard':
        return json(200, {
          planId: 'plan-1',
          categories: [
            {
              categoryId: 'cat-groceries',
              categoryName: 'Groceries',
              privacyLevel: 'total_only',
              totalAmountMinor: '140000',
              currency: 'PLN',
              transactionCount: 9,
            },
            {
              categoryId: 'cat-rent',
              categoryName: 'Rent',
              privacyLevel: 'full_detail',
              totalAmountMinor: '320000',
              currency: 'PLN',
              transactionCount: 1,
            },
          ],
        });
      case 'POST /households/invites/accept':
        return json(200, { householdId: 'hh-1', accessToken: 'joined-access' });
      default:
        return json(404, { statusCode: 404, code: 'not_found' });
    }
  });

  return state;
}

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('pb_ui013_seeded')) {
      sessionStorage.setItem('pb_ui013_seeded', '1');
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

/** Full-page screenshots of the current page in both D7 themes, attached to the report. */
async function attachThemeShots(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((value) => {
      document.documentElement.setAttribute('data-theme', value);
      document.documentElement.style.colorScheme = value;
    }, theme);
    await testInfo.attach(`${name}-${theme}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
}

async function shot(page: Page, name: string): Promise<void> {
  if (SCREENSHOT_DIR !== undefined) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
  }
}

test.describe('UI-013 screens', () => {
  test('plan dashboard shows planned vs actual, unplanned and the net @smoke', async ({
    page,
  }, testInfo) => {
    await signIn(page);
    await stubApi(page, profile('user-ann', 'ann@example.com'));
    if (!(await open(page, '/plans/plan-1/dashboard'))) {
      test.skip(true, 'Dev server not running');

      return;
    }

    await expect(page.getByRole('heading', { name: 'October' })).toBeVisible();
    await expect(page.getByText('Data as of 21 Oct 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planned vs spent' })).toBeVisible();
    const groceries = page.getByRole('article', { name: 'Groceries' });
    await expect(groceries.getByText('zł 1,400.00 of zł 1,930.00')).toBeVisible();
    await expect(groceries.getByText('planned as €100.00')).toBeVisible();
    // DSN-020: the D7 category row names the overspend ("Over by …") instead of "Over budget".
    await expect(
      page.getByRole('article', { name: 'Rent' }).getByText('Over by zł 200.00'),
    ).toBeVisible();
    await expect(page.getByText('Allegro')).toBeVisible();
    await expect(
      page.getByText('Wise card · Lidl Berlin').locator('xpath=ancestor::li[1]'),
    ).toContainText(/−€\s?12\.40/);
    await expect(page.getByText('+zł 5,221.76')).toBeVisible();
    await shot(page, 'plan-dashboard');
    await attachThemeShots(page, testInfo, 'plan-dashboard');
  });

  test('the owner invites the partner from the household screen @smoke', async ({ page }) => {
    await signIn(page);
    const api = await stubApi(page, profile('user-ann', 'ann@example.com'));
    if (!(await open(page, '/household'))) {
      test.skip(true, 'Dev server not running');

      return;
    }

    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    // A total_only category shows the sum and the privacy tag, never its details.
    await expect(
      page.getByRole('group', { name: /^Groceries:.*totals only$/ }).getByText('Totals only'),
    ).toBeVisible();
    await page.getByLabel("Partner's email").fill('bob@example.com');
    await page.getByRole('button', { name: 'Invite partner' }).click();

    await expect(page.getByText('Invite sent.')).toBeVisible();
    await expect(page.getByText('Invite pending, valid until 28 Oct 2026')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resend invite' })).toBeVisible();
    expect(api.posts).toContainEqual({
      url: '/households/invites',
      body: { email: 'bob@example.com' },
    });
    await shot(page, 'household');
  });

  test('the partner accepts the invite from the email link @smoke', async ({ page }) => {
    await signIn(page);
    const api = await stubApi(page, profile('user-bob', 'bob@example.com'));
    if (!(await open(page, '/invite/accept?token=raw-token'))) {
      test.skip(true, 'Dev server not running');

      return;
    }

    await expect(page.getByRole('heading', { name: 'Join a household' })).toBeVisible();
    await shot(page, 'accept-invite');
    await page.getByRole('button', { name: 'Accept invite' }).click();

    await expect(page).toHaveURL(/\/household$/);
    expect(api.posts).toContainEqual({
      url: '/households/invites/accept',
      body: { token: 'raw-token' },
    });
    expect(await page.evaluate(() => localStorage.getItem('pb_access_token'))).toBe(
      'joined-access',
    );
    expect(await page.evaluate(() => localStorage.getItem('pb_refresh_token'))).toBe(
      'smoke-refresh',
    );
  });
});
