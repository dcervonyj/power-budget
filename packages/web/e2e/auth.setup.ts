import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('save auth state', async ({ page }) => {
  if (process.env['TEST_ENV'] !== 'e2e') {
    // Write empty storage state when not in full e2e mode
    await page.context().storageState({ path: authFile });
    return;
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env['TEST_USER_EMAIL'] ?? 'test@example.com');
  await page.getByLabel('Password').fill(process.env['TEST_USER_PASSWORD'] ?? 'password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.context().storageState({ path: authFile });
});
