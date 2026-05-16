import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { BankConnectionsList } from '../../components/bank/BankConnectionsList.js';
import { BankSyncFailureBanner } from '../../components/bank/BankSyncFailureBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';

export const BankConnectionsScreen = observer(function BankConnectionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    void bankConnectionStore.fetchConnections();
  }, []);

  return (
    <div
      style={{
        padding: theme.space['2xl'],
        maxWidth: 800,
        margin: '0 auto',
        color: theme.color.text.primary,
      }}
    >
      <BankSyncFailureBanner />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.space.xl,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: theme.fontSize['2xl'],
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          <FormattedMessage id="bankConnections.title" />
        </h1>
        <Button
          variant="primary"
          onClick={() => {
            void navigate('/bank-connections/new');
          }}
        >
          <FormattedMessage id="bankConnections.add" />
        </Button>
      </div>

      {bankConnectionStore.loading && bankConnectionStore.connections.length === 0 && (
        <SkeletonList rows={3} rowHeight={72} />
      )}

      {!bankConnectionStore.loading && bankConnectionStore.connections.length === 0 && (
        <EmptyState
          icon="🏦"
          title={
            <FormattedMessage
              id="component.shared.empty.noBankAccounts"
              defaultMessage="No bank accounts connected"
            />
          }
          action={{
            label: (
              <FormattedMessage
                id="component.shared.empty.addAccount"
                defaultMessage="Add account"
              />
            ),
            onPress: () => {
              void navigate('/bank-connections/new');
            },
          }}
        />
      )}

      {bankConnectionStore.connections.length > 0 && (
        <BankConnectionsList
          store={bankConnectionStore}
          onAddConnection={() => {
            void navigate('/bank-connections/new');
          }}
        />
      )}
    </div>
  );
});
