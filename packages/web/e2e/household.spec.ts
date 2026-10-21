import { test, expect } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';
import { BackendApi, PASSWORD, seedTwoUserHousehold, uniqueEmail } from './support/api.js';

test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('household journey (2-user fixture)', () => {
  test('the partner who accepted the invite sees the shared plan on the dashboard', async ({
    page,
    request,
  }) => {
    const api = new BackendApi(request);
    // Owner registers, invites; the worker emails the invite; partner registers and accepts.
    const household = await seedTwoUserHousehold(api);
    const plan = await api.createPlan(household.owner.tokens.accessToken, {
      name: 'Shared groceries',
      type: 'household',
      baseCurrency: 'PLN',
    });
    const category = await api.expenseCategory(household.owner.tokens.accessToken);
    await api.addExpenseItem(
      household.owner.tokens.accessToken,
      plan.id,
      category.id,
      '120000',
      'PLN',
    );

    // A fresh password login lands the partner in the shared household.
    await page.goto('/login');
    await page.getByLabel('Email').fill(household.partner.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Shared groceries')).toBeVisible();
    await expect(page.getByText(category.name, { exact: true })).toBeVisible();
  });

  test('a user outside the household does not see its plans', async ({ request }) => {
    const api = new BackendApi(request);
    const household = await seedTwoUserHousehold(api);
    const plan = await api.createPlan(household.owner.tokens.accessToken, {
      name: 'Private to the household',
      type: 'household',
      baseCurrency: 'PLN',
    });
    const stranger = await api.register(uniqueEmail('stranger'));

    expect((await api.get(`/plans/${plan.id}`, stranger.accessToken)).status()).toBe(404);
    expect(
      (await api.get(`/plans/${plan.id}`, household.partner.tokens.accessToken)).status(),
    ).toBe(200);
  });

  // FIXME(CLN-017): the web app has no invite UI. No route, button or string for
  // "invite partner" exists in packages/web/src (HouseholdScreen only drills into
  // categories); POST /households/invites is reachable through the API only.
  test.fixme('the owner invites the partner from the household screen', async () => {});

  // FIXME(CLN-017): the invite email links to /invite/accept?token=..., but the web
  // app has no such route (App.tsx falls through to /dashboard), so the partner
  // cannot accept in the browser; POST /households/invites/accept works via the API.
  test.fixme('the partner accepts the invite from the email link', async () => {});
});
