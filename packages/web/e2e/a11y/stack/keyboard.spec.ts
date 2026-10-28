import { expect, test } from '@playwright/test';
import { BackendApi, signInWithTokens, uniqueEmail } from '../../support/api.js';
import { FULL_STACK } from '../../support/stack.js';
import { escapesOfDialogTrap, walkTabOrder } from '../support/keyboard.js';

// DSN-050: keyboard-only pass on the real app: tab order and focus ring on the main screens, and
// the Clone plan dialog traps Tab, closes on Esc and hands focus back to the button that opened it.
test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

const SCREENS = ['/dashboard', '/transactions', '/plans', '/categories', '/settings/profile'];

for (const path of SCREENS) {
  test(`tab order and focus ring ${path}`, async ({ page, request }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('a11y-kbd'));
    await api.createPlan(tokens.accessToken, {
      name: 'Household budget',
      type: 'personal',
      baseCurrency: 'PLN',
    });
    await signInWithTokens(page, tokens);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').first()).toBeVisible();

    const report = await walkTabOrder(page, 'body');

    expect(report.positiveTabindex).toEqual([]);
    expect(report.unreached).toEqual([]);
    expect(report.outOfOrder).toEqual([]);
    expect(report.stops.filter((stop) => !stop.visibleFocus).map((stop) => stop.label)).toEqual([]);
  });
}

test('Clone plan dialog traps focus, closes on Esc and returns focus to its opener', async ({
  page,
  request,
}) => {
  const api = new BackendApi(request);
  const tokens = await api.register(uniqueEmail('a11y-clone'));
  await api.createPlan(tokens.accessToken, {
    name: 'Household budget',
    type: 'personal',
    baseCurrency: 'PLN',
  });
  await signInWithTokens(page, tokens);
  await page.goto('/plans');
  const opener = page.getByRole('button', { name: /clone/i }).first();
  await opener.focus();

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await escapesOfDialogTrap(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
