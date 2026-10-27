import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';
import {
  BackendApi,
  signInWithTokens,
  uniqueEmail,
  type PlanDto,
  type PlannedItemDto,
} from './support/api.js';
import type { PlanDashboardResponseDto } from '../src/infrastructure/api/PlanDashboardMapper.js';

test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('plan journey', () => {
  test('creates a plan with an item in the UI and sees it on the dashboard', async ({
    page,
    request,
  }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('planner'));
    const category = await api.expenseCategory(tokens.accessToken);
    await signInWithTokens(page, tokens);

    await page.goto('/plans');
    await expect(page.getByText('No plans yet')).toBeVisible();
    await page.getByRole('button', { name: 'Create new plan' }).click();
    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}$/);
    const planId = page.url().split('/').pop() ?? '';
    // Item in the plan currency: a fresh stack has no FX rates to convert with.
    const plan = await api.json<PlanDto>(
      await api.get(`/plans/${planId}`, tokens.accessToken),
      200,
    );

    // The new-item row: category picker (unlabelled, placeholder "Category"), then amount and currency.
    await page.locator('#plan-new-item-category').selectOption({ label: category.name });
    await page.getByLabel('Amount').last().fill('250.50');
    await page.getByLabel('Currency').last().fill(plan.baseCurrency);
    await page.getByRole('button', { name: 'Add item' }).click();

    // The item is stored, with exact minor units.
    await expect
      .poll(async () => {
        const items = await api.json<PlannedItemDto[]>(
          await api.get(`/plans/${planId}/items`, tokens.accessToken),
          200,
        );

        return items.map((item) => [item.categoryId, item.direction, item.amount]);
      })
      .toEqual([[category.id, 'expense', { amountMinor: '25050', currency: plan.baseCurrency }]]);

    await page.goto('/dashboard');
    // DSN-020: the D7 Overview titles the expense panel "Planned vs spent".
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planned vs spent' })).toBeVisible();
    await expect(page.getByText(category.name, { exact: true })).toBeVisible();
  });

  test('the dashboard lists a new planned item with its amount', async ({
    page,
    request,
  }, testInfo) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('dashboard'));
    const category = await api.expenseCategory(tokens.accessToken);
    const plan = await api.createPlan(tokens.accessToken, {
      name: 'Dashboard plan',
      type: 'personal',
      baseCurrency: 'PLN',
    });
    const item = await api.addExpenseItem(tokens.accessToken, plan.id, category.id, '25050', 'PLN');

    const dashboard = await api.json<PlanDashboardResponseDto>(
      await api.get(`/plans/${plan.id}/dashboard`, tokens.accessToken),
      200,
    );
    expect(dashboard.expenseLines.map((line) => [line.plannedItemId, line.planned])).toEqual([
      [item.id, { amountMinor: '25050', currency: 'PLN' }],
    ]);
    expect(dashboard.totalPlannedExpenses).toEqual({ amountMinor: '25050', currency: 'PLN' });

    await signInWithTokens(page, tokens);
    await page.goto('/dashboard');
    await expect(page.getByText(category.name, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safe to spend today' })).toBeVisible();
    await attachThemeShots(page, testInfo, 'overview');
  });
});

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
