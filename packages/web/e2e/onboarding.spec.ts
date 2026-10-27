import { test, expect } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';
import { BackendApi, PASSWORD, uniqueEmail } from './support/api.js';

// Real backend only (TEST_ENV=e2e): the login below hits the API and Postgres.
test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('auth to onboarding journey', () => {
  test('logs in, walks the five steps and lands on the dashboard with the choices saved', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('onboarding');
    await new BackendApi(request).register(email);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: 'Choose your language' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Step 1 of 5' })).toBeVisible();
    await page.getByRole('radio', { name: 'English' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Set your base currency' })).toBeVisible();
    await page.getByLabel('Base currency').selectOption('PLN');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Track additional currencies' })).toBeVisible();
    await page.getByRole('button', { name: 'EUR' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Connect your bank' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page.getByRole('heading', { name: 'Create your first plan' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Step 5 of 5' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await page.evaluate(() => localStorage.getItem('pb_base_currency'))).toBe('PLN');
    expect(await page.evaluate(() => localStorage.getItem('pb_interesting_currencies'))).toBe(
      '["EUR"]',
    );
  });
});
