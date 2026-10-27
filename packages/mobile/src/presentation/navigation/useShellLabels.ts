import { useIntl } from 'react-intl';

export type ShellTabKey = 'overview' | 'transactions' | 'toSort' | 'plan';
export type AccountMenuKey = 'settings' | 'categories' | 'household' | 'banks' | 'audit';
export type ShellTitleKey =
  | ShellTabKey
  | AccountMenuKey
  | 'transaction'
  | 'planEditor'
  | 'planDashboard'
  | 'addBank'
  | 'addExpense';

export interface ShellLabels {
  tab(key: ShellTabKey): string;
  addExpense(): string;
  tabBar(): string;
  accountMenu(): string;
  menuItem(key: AccountMenuKey): string;
  back(): string;
  title(key: ShellTitleKey): string;
}

/** i18n strings of the mobile shell (shell.* messages). */
export function useShellLabels(): ShellLabels {
  const intl = useIntl();

  return {
    tab(key) {
      return intl.formatMessage(TAB_MESSAGES[key]);
    },
    addExpense() {
      return intl.formatMessage({ id: 'shell.tab.add', defaultMessage: 'Add expense' });
    },
    tabBar() {
      return intl.formatMessage({ id: 'shell.tabBar', defaultMessage: 'Main navigation' });
    },
    accountMenu() {
      return intl.formatMessage({ id: 'shell.account.menu', defaultMessage: 'Account menu' });
    },
    menuItem(key) {
      return intl.formatMessage(MENU_MESSAGES[key]);
    },
    back() {
      return intl.formatMessage({ id: 'shell.header.back', defaultMessage: 'Back' });
    },
    title(key) {
      if (key === 'transaction') {
        return intl.formatMessage({
          id: 'shell.title.transaction',
          defaultMessage: 'Transaction',
        });
      }
      if (key === 'planEditor') {
        return intl.formatMessage({ id: 'shell.title.planEditor', defaultMessage: 'Edit plan' });
      }
      if (key === 'planDashboard') {
        return intl.formatMessage({ id: 'shell.title.planDashboard', defaultMessage: 'Plan' });
      }
      if (key === 'addBank') {
        return intl.formatMessage({ id: 'shell.title.addBank', defaultMessage: 'Add a bank' });
      }
      if (key === 'addExpense') {
        return intl.formatMessage({ id: 'shell.tab.add', defaultMessage: 'Add expense' });
      }
      if (key === 'overview' || key === 'transactions' || key === 'toSort' || key === 'plan') {
        return intl.formatMessage(TAB_MESSAGES[key]);
      }

      return intl.formatMessage(MENU_MESSAGES[key]);
    },
  };
}

const TAB_MESSAGES = {
  overview: { id: 'shell.tab.overview', defaultMessage: 'Overview' },
  transactions: { id: 'shell.tab.transactions', defaultMessage: 'Transactions' },
  toSort: { id: 'shell.tab.toSort', defaultMessage: 'To sort' },
  plan: { id: 'shell.tab.plan', defaultMessage: 'Plan' },
} as const;

const MENU_MESSAGES = {
  settings: { id: 'shell.menu.settings', defaultMessage: 'Settings' },
  categories: { id: 'shell.menu.categories', defaultMessage: 'Categories' },
  household: { id: 'shell.menu.household', defaultMessage: 'Household' },
  banks: { id: 'shell.menu.banks', defaultMessage: 'Banks' },
  audit: { id: 'shell.menu.audit', defaultMessage: 'Audit log' },
} as const;
