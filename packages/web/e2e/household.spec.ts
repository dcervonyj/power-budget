import { test, expect } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';
import {
  BackendApi,
  PASSWORD,
  seedTwoUserHousehold,
  signInWithTokens,
  uniqueEmail,
} from './support/api.js';

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
    await expect(page.getByRole('heading', { name: 'Shared groceries' })).toBeVisible();
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

  test('the owner invites the partner from the household screen', async ({ page, request }) => {
    const api = new BackendApi(request);
    const owner = await api.register(uniqueEmail('owner'));
    const partnerEmail = uniqueEmail('partner');
    await signInWithTokens(page, owner);

    await page.goto('/household');
    await expect(page.getByText('Owner', { exact: true })).toBeVisible();
    await page.getByLabel("Partner's email").fill(partnerEmail);
    await page.getByRole('button', { name: 'Invite partner' }).click();

    await expect(page.getByText('Invite sent.')).toBeVisible();
    await expect(page.getByText(partnerEmail)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resend invite' })).toBeVisible();
    // The worker emailed the invite link through the real outbox.
    expect(await api.inviteToken(partnerEmail)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('the partner accepts the invite from the email link', async ({ page, request }) => {
    const api = new BackendApi(request);
    const ownerEmail = uniqueEmail('owner');
    const partnerEmail = uniqueEmail('partner');
    const owner = await api.register(ownerEmail);
    await api.invite(owner.accessToken, partnerEmail);
    const token = await api.inviteToken(partnerEmail);
    await api.register(partnerEmail);

    // Signed out, the link goes through login and comes back to the invite.
    await page.goto(`/invite/accept?token=${token}`);
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(partnerEmail);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Join a household' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept invite' }).click();

    await expect(page).toHaveURL(/\/household$/);
    await expect(page.getByText(ownerEmail)).toBeVisible();
    await expect(page.getByText('(you)')).toBeVisible();
    const accessToken = await page.evaluate(() => localStorage.getItem('pb_access_token'));
    const members = await api.json<Array<{ email: string; role: string }>>(
      await api.get('/households/members', accessToken ?? ''),
      200,
    );
    expect(members.map(({ email, role }) => [email, role])).toEqual([
      [ownerEmail, 'owner'],
      [partnerEmail, 'member'],
    ]);
  });
});
