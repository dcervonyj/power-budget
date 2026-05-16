import { test as setup } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authDir = path.join(__dirname, '.auth');
const authFile = path.join(authDir, 'user.json');
mkdirSync(authDir, { recursive: true });

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
