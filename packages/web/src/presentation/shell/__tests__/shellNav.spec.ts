import { describe, expect, it } from 'vitest';
import { activeNavItem, headerItemOf } from '../shellNav.js';

describe('activeNavItem', () => {
  it.each([
    ['/dashboard', '', 'overview'],
    ['/transactions', '', 'transactions'],
    ['/transactions/tx-1', '', 'transactions'],
    ['/transactions', '?status=mapped', 'transactions'],
    ['/transactions', '?status=unmapped', 'toSort'],
    ['/transactions', '?q=bolt&status=unmapped', 'toSort'],
    ['/plans', '', 'plan'],
    ['/plans/plan-1', '', 'plan'],
    ['/plans/plan-1/dashboard', '', 'plan'],
    ['/categories', '', null],
    ['/settings/profile', '', null],
    ['/transactionsx', '', null],
  ])('%s%s is %s', (pathname, search, expected) => {
    expect(activeNavItem(pathname, search)).toBe(expected);
  });
});

describe('headerItemOf', () => {
  it('shows the to-sort list as transactions in the header', () => {
    expect(headerItemOf('toSort')).toBe('transactions');
    expect(headerItemOf('plan')).toBe('plan');
    expect(headerItemOf(null)).toBeNull();
  });
});
