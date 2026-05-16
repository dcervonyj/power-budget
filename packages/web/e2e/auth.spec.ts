import { test, expect } from '@playwright/test';

// Full auth flow tests — only run in full e2e mode (TEST_ENV=e2e with live backend)
test.beforeEach(() => {
  if (process.env['TEST_ENV'] !== 'e2e') {
    test.skip(true, 'Skipped: TEST_ENV != e2e (requires live backend)');
  }
});

test.describe('auth flow', () => {
  test('register → login → see dashboard', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    // Register
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /register/i }).click();

    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env['TEST_USER_EMAIL'] ?? 'test@example.com');
    await page.getByLabel('Password').fill(process.env['TEST_USER_PASSWORD'] ?? 'password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should show error and stay on login
    await expect(page).toHaveURL(/\/login/);
  });
});
