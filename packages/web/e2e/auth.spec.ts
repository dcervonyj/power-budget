import { test, expect } from '@playwright/test';
import { FULL_STACK, STACK } from './support/stack.js';
import { BackendApi, PASSWORD, uniqueEmail } from './support/api.js';

// Real backend only (TEST_ENV=e2e): every step below hits the API and Postgres.
test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('auth journey', () => {
  test('registers in the UI and is sent to the login screen', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill(uniqueEmail('register'));
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test('refuses to register an email twice', async ({ page, request }) => {
    const email = uniqueEmail('duplicate');
    await new BackendApi(request).register(email);

    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  });

  test('logs in with a registered account and lands on an empty dashboard', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('login');
    await new BackendApi(request).register(email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('No active budget plan')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pb_access_token'))).not.toBeNull();
  });

  test('rejects a wrong password and stays on the login screen', async ({ page, request }) => {
    const email = uniqueEmail('wrong-password');
    await new BackendApi(request).register(email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('pb_access_token'))).toBeNull();
  });

  test('logs out from the profile settings and revokes the session', async ({ page, request }) => {
    const api = new BackendApi(request);
    const email = uniqueEmail('logout');
    await api.register(email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const refreshToken = await page.evaluate(() => localStorage.getItem('pb_refresh_token'));

    await page.goto('/settings/profile');
    await page.getByRole('button', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('pb_access_token'))).toBeNull();
    // The refresh token no longer works on the server either.
    const refreshed = await request.post(`${STACK.apiUrl}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refreshed.status()).toBe(401);
  });
});
