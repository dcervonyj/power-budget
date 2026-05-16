import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { ReconnectBanner } from '../../components/bank/ReconnectBanner.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';

export const DashboardScreen = observer(function DashboardScreen(): React.JSX.Element {
  useEffect(() => {
    void bankConnectionStore.fetchConnections();
  }, []);

  return (
    <div>
      <ReconnectBanner connections={bankConnectionStore.connections} />
      <FormattedMessage id="screen.dashboard.title" defaultMessage="Dashboard" />
    </div>
  );
});
