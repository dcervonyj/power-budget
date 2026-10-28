import { expect, test, type Page } from '@playwright/test';
import { BackendApi, signInWithTokens, uniqueEmail, type PlanDto } from '../../support/api.js';
import { FULL_STACK } from '../../support/stack.js';
import { THEMES, type Theme } from '../support/gallery.js';
import { runAxe } from '../support/axe.js';

// DSN-050: axe on the real pages of the e2e stack, in both themes. Serious and critical findings fail.
test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

const PUBLIC_PAGES = ['/login', '/register', '/auth/magic-link'] as const;
const APP_PAGES = [
  '/dashboard',
  '/transactions',
  '/plans',
  '/plans/:planId',
  '/plans/:planId/dashboard',
  '/categories',
  '/household',
  '/bank-connections',
  '/settings/profile',
  '/settings/appearance',
  '/settings/locale',
  '/settings/currency',
  '/settings/data',
  '/audit',
  '/onboarding',
] as const;

async function prefer(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('pb_theme', value);
  }, theme);
}

for (const theme of THEMES) {
  test.describe(`stack pages ${theme}`, () => {
    for (const path of PUBLIC_PAGES) {
      test(`axe ${path} ${theme}`, async ({ page }, testInfo) => {
        await prefer(page, theme);
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const { blocking } = await runAxe(page, testInfo);

        expect(blocking).toEqual([]);
      });
    }

    for (const template of APP_PAGES) {
      test(`axe ${template} ${theme}`, async ({ page, request }, testInfo) => {
        const api = new BackendApi(request);
        const tokens = await api.register(uniqueEmail('a11y'));
        const category = await api.expenseCategory(tokens.accessToken);
        const plan = await api.createPlan(tokens.accessToken, {
          name: 'Household budget',
          type: 'personal',
          baseCurrency: 'PLN',
        });
        await api.addExpenseItem(tokens.accessToken, plan.id, category.id, '25050', 'PLN');
        await signInWithTokens(page, tokens);
        await prefer(page, theme);

        await openAppPage(page, template, plan);
        const { blocking } = await runAxe(page, testInfo);

        expect(blocking).toEqual([]);
      });
    }
  });
}

async function openAppPage(page: Page, template: string, plan: PlanDto): Promise<void> {
  await page.goto(template.replace(':planId', plan.id));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main').first()).toBeVisible();
}
