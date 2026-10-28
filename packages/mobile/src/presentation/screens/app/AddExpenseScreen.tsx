import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useIntl } from 'react-intl';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parseLocalIsoDate } from '@power-budget/core';
import { apiClient, categoriesApi, plansApi } from '../../../infrastructure/index.js';
import type { AppStackParamList } from '../../navigation/types.js';
import { makeStyles } from '../../theme/index.js';
import { EmptyState } from '../../glass/overlays/EmptyState.js';
import { ErrorBanner } from '../../glass/overlays/ErrorBanner.js';
import { Skeleton } from '../../glass/overlays/Skeleton.js';
import { AddExpenseApi } from './add/AddExpenseApi.js';
import { AddExpenseView } from './add/AddExpenseView.js';
import { useAddExpense } from './add/useAddExpense.js';
import type { AddExpenseGateway } from './add/useAddExpense.js';

const useStyles = makeStyles((glass) => ({
  centered: { flex: 1, padding: glass.space.lg, gap: glass.space.md, justifyContent: 'center' },
}));

/** Add expense: loads the plan, categories and accounts, then hands everything to the View. */
export function AddExpenseScreen(): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const sources = useMemo(createSources, []);
  const state = useAddExpense(sources);
  const { load } = state;

  if (load.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <Skeleton height={96} />
        <Skeleton height={160} />
      </View>
    );
  }
  if (load.kind === 'failed') {
    return (
      <View style={styles.centered}>
        <ErrorBanner
          message={intl.formatMessage({
            id: 'add.error.load',
            defaultMessage: 'Could not load your plan. Try again.',
          })}
          onRetry={state.reload}
        />
      </View>
    );
  }
  if (load.kind === 'no-plan') {
    return (
      <View style={styles.centered}>
        <EmptyState
          title={intl.formatMessage({ id: 'add.empty.noPlan', defaultMessage: 'No active plan' })}
        />
      </View>
    );
  }

  return (
    <AddExpenseView
      plan={load.data.plan}
      currency={load.data.currency}
      dateLabel={intl.formatDate(parseLocalIsoDate(state.today), {
        day: 'numeric',
        month: 'short',
      })}
      typed={state.typed}
      categories={load.data.categories}
      categoryId={state.categoryId}
      accounts={load.data.accounts}
      accountId={state.accountId}
      status={state.status}
      unsorted={state.unsorted}
      error={state.error}
      onTypedChange={state.setTyped}
      onCategoryChange={state.setCategoryId}
      onAccountChange={state.setAccountId}
      onSave={state.save}
      onUndo={state.undo}
      onAddAnother={state.addAnother}
      onRetryRefresh={state.retryRefresh}
      onRetryCategory={state.retryCategory}
      onBackToToday={() => {
        navigation.navigate('Tabs', { screen: 'Dashboard' });
      }}
    />
  );
}

function createSources(): AddExpenseGateway {
  const api = new AddExpenseApi(apiClient);

  return {
    activePlans: () => plansApi.list('active'),
    dashboard: (planId) => plansApi.dashboard(planId),
    categories: () => categoriesApi.list(),
    accounts: () => api.accounts(),
    api,
  };
}
