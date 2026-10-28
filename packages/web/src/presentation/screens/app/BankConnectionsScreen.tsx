import { bankConnectionStore } from '../../../composition.js';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { consentRedirectUri, goToConsent } from '../../../application/bank/consentRedirect.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { BankConnectionsView } from '../../components/bank/BankConnectionsView.js';

export const BankConnectionsScreen = observer(function BankConnectionsScreen(): React.JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void bankConnectionStore.fetchConnections();
  }, []);

  async function reconnect(id: string): Promise<void> {
    const consentUrl = await bankConnectionStore.reconnect(id, consentRedirectUri());
    if (consentUrl !== null) {
      goToConsent(consentUrl);
    }
  }

  return (
    <BankConnectionsView
      connections={bankConnectionStore.connections}
      loading={bankConnectionStore.loading}
      error={bankConnectionStore.error !== null}
      actionError={bankConnectionStore.actionError}
      refreshingIds={bankConnectionStore.refreshingIds}
      now={new Date()}
      onAddConnection={() => {
        void navigate(ROUTE_PATHS.addBankConnection);
      }}
      onReconnect={(id) => {
        void reconnect(id);
      }}
      onRefresh={(id) => {
        void bankConnectionStore.refresh(id);
      }}
      onRetry={() => {
        void bankConnectionStore.fetchConnections();
      }}
    />
  );
});
