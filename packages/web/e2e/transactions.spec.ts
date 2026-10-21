import { test } from '@playwright/test';
import { FULL_STACK } from './support/stack.js';

test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('manual transaction journey', () => {
  // FIXME(CLN-017): not reachable end to end.
  // - Web: ManualTransactionForm exists but no screen renders it; the transactions
  //   screen has no "add" action.
  // - API: POST /transactions needs an accountId the household owns, and accounts are
  //   only created by a completed bank connection (GoCardless consent). There is no
  //   public endpoint for a manual/cash account, so a fresh household cannot add a
  //   manual transaction at all.
  // Expected once fixed: add a transaction in the UI, map it to the planned item, and
  // see the actual amount (or the unplanned total) change on the dashboard.
  test.fixme('adds a manual transaction and sees it on the dashboard', async () => {});
});
