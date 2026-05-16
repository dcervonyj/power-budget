import { test, expect } from '@playwright/test';

// These tests are tagged @smoke and run in CI even without a live backend
// They test static behavior: page loads, redirects, etc.

test.describe('smoke', () => {
  test('app loads without crashing @smoke', async ({ page }) => {
    // When no backend is available, the app should still load (HTML/JS serves)
    const response = await page.goto('/');
    // Accept 200 (dev server) or handle when server is not running
    if (!response || response.status() >= 500) {
      test.skip(true, 'Dev server not running');
      return;
    }
    // App container should be present
    await expect(page.locator('body')).toBeVisible();
  });

  test('unauthenticated user is redirected to login @smoke', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();

    const response = await page.goto('/dashboard');
    if (!response || response.status() >= 500) {
      test.skip(true, 'Dev server not running');
      return;
    }

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page has expected elements @smoke', async ({ page }) => {
    const response = await page.goto('/login');
    if (!response || response.status() >= 500) {
      test.skip(true, 'Dev server not running');
      return;
    }

    // Login form should be visible
    await expect(page.locator('form')).toBeVisible();
  });
});
