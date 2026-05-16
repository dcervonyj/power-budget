import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { BankConnectionsList } from '../../components/bank/BankConnectionsList.js';
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

      <BankConnectionsList
        store={bankConnectionStore}
        onAddConnection={() => {
          void navigate('/bank-connections/new');
        }}
      />
    </div>
  );
});
