import { test, expect, type APIResponse } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';
import { BackendApi, seedTwoUserHousehold, signInWithTokens, uniqueEmail } from './support/api.js';
import type { PlanDashboardResponseDto } from '../src/infrastructure/api/PlanDashboardMapper.js';

test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

interface ListItem {
  readonly id: string;
  readonly occurredOn: string;
  readonly description: string;
  readonly amount: { readonly amountMinor: string; readonly currency: string };
  readonly ignored: boolean;
  readonly mappingSource: string;
  readonly mapping: { readonly plannedItemId: string } | null;
}

function localToday(): string {
  const now = new Date();

  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

async function listed(api: BackendApi, accessToken: string): Promise<ListItem[]> {
  const page = await api.json<{ items: ListItem[] }>(
    await api.get('/transactions?limit=50', accessToken),
    200,
  );

  return page.items;
}

/** A cash account and transactions on it through the API (fixtures). */
async function cashTransactions(
  api: BackendApi,
  accessToken: string,
  descriptions: ReadonlyArray<string>,
): Promise<string[]> {
  const account = await api.json<{ id: string }>(
    await api.post('/accounts', accessToken, { name: 'Cash', currency: 'PLN' }),
    201,
  );
  const ids: string[] = [];
  for (const description of descriptions) {
    const res: APIResponse = await api.post('/transactions', accessToken, {
      accountId: account.id,
      occurredOn: localToday(),
      amountMinor: '-1000',
      currency: 'PLN',
      description,
    });
    ids.push((await api.json<{ id: string }>(res, 201)).id);
  }

  return ids;
}

test.describe('manual transaction journey', () => {
  test('adds a manual transaction and sees it on the dashboard', async ({ page, request }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('cash'));
    const category = await api.expenseCategory(tokens.accessToken);
    const plan = await api.createPlan(tokens.accessToken, {
      name: 'Cash plan',
      type: 'personal',
      baseCurrency: 'PLN',
    });
    const item = await api.addExpenseItem(tokens.accessToken, plan.id, category.id, '25050', 'PLN');
    await signInWithTokens(page, tokens);

    // No account yet: the form first creates a cash account.
    await page.goto('/transactions');
    await expect(page.getByText('No transactions yet')).toBeVisible();
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
    await expect(page.getByLabel('Currency')).toHaveValue('PLN');
    await page.getByRole('button', { name: 'Create cash account' }).click();

    // Normal units in, exact minor units out; the currency is the account's.
    await expect(page.getByTestId('mtf-currency')).toHaveText('PLN');
    await page.getByLabel('Amount').fill('12,50');
    await page.getByLabel('Description').fill('Corner shop');
    await page.getByRole('button', { name: 'Add Transaction', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Transaction added.');
    const row = page.getByRole('group', { name: /Corner shop/ });
    await expect(row).toBeVisible();
    await expect(row.getByText('To sort')).toBeVisible();
    const [created] = await listed(api, tokens.accessToken);
    expect(created).toMatchObject({
      description: 'Corner shop',
      occurredOn: localToday(),
      amount: { amountMinor: '-1250', currency: 'PLN' },
      mapping: null,
    });

    // Unmapped, it shows on the plan dashboard as unplanned.
    await page.goto('/dashboard');
    await expect(page.getByText('Corner shop')).toBeVisible();

    // Mapped from the list, it counts against the planned item.
    await page.goto('/transactions');
    await row.getByRole('button', { name: 'Choose a category for Corner shop' }).click();
    await page.getByRole('radio', { name: new RegExp(category.name) }).click();
    await page.getByRole('button', { name: 'Map transaction' }).click();
    await expect(row.getByText('Added by hand')).toBeVisible();
    await expect(row.getByText(new RegExp(category.name))).toBeVisible();
    await expect(row.getByText('To sort')).toHaveCount(0);

    await expect
      .poll(async () => {
        const dashboard = await api.json<PlanDashboardResponseDto>(
          await api.get(`/plans/${plan.id}/dashboard`, tokens.accessToken),
          200,
        );

        return dashboard.expenseLines.map((line) => [line.plannedItemId, line.actual]);
      })
      .toEqual([[item.id, { amountMinor: '1250', currency: 'PLN' }]]);
    const [mapped] = await listed(api, tokens.accessToken);
    expect(mapped).toMatchObject({ mappingSource: 'manual', mapping: { plannedItemId: item.id } });
  });

  test('bulk-ignores and bulk-marks transfers from the selection', async ({ page, request }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('bulk'));
    const [first, second, third] = await cashTransactions(api, tokens.accessToken, [
      'Refund one',
      'Refund two',
      'To savings',
    ]);
    await signInWithTokens(page, tokens);

    await page.goto('/transactions');
    await page.getByLabel(`Select transaction ${String(first)}`).check();
    await page.getByLabel(`Select transaction ${String(second)}`).check();
    await page.getByRole('button', { name: 'Ignore (2)' }).click();

    await expect(
      page.getByRole('group', { name: /Refund one/ }).getByText(/Ignored/),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: /Refund two/ }).getByText(/Ignored/),
    ).toBeVisible();

    await page.getByLabel(`Select transaction ${String(third)}`).check();
    await page.getByRole('button', { name: 'Mark as Transfer (1)' }).click();
    await expect(
      page.getByRole('group', { name: /To savings/ }).getByText('Transfer', { exact: true }),
    ).toBeVisible();

    const rows = new Map((await listed(api, tokens.accessToken)).map((tx) => [tx.id, tx]));
    expect([first, second, third].map((id) => rows.get(String(id))?.ignored)).toEqual([
      true,
      true,
      false,
    ]);
  });

  test('shows the sorting panel and day groups in both themes', async ({ page, request }, info) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('themes'));
    await cashTransactions(api, tokens.accessToken, ['Corner shop', 'Bakery']);
    await signInWithTokens(page, tokens);

    await page.goto('/transactions');
    await expect(page.getByRole('heading', { name: 'Sorting' })).toBeVisible();
    await expect(page.getByText('0 sorted · 2 to sort')).toBeVisible();

    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => {
        document.documentElement.setAttribute('data-theme', value);
      }, theme);
      await page.screenshot({ path: info.outputPath(`transactions-${theme}.png`), fullPage: true });
    }
  });

  test("a partner's transaction opened by URL closes with a notice", async ({ page, request }) => {
    const api = new BackendApi(request);
    const household = await seedTwoUserHousehold(api);
    const [partnerTx] = await cashTransactions(api, household.partner.tokens.accessToken, [
      'Partner private',
    ]);
    await signInWithTokens(page, household.owner.tokens);

    await page.goto(`/transactions/${String(partnerTx)}`);

    await expect(page.getByRole('status')).toContainText(
      'This transaction is no longer available.',
    );
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText('Partner private')).toHaveCount(0);
  });
});
