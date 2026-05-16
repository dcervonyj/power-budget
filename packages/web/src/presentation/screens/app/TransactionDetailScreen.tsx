import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TransactionListScreen } from './TransactionListScreen.js';
import { TransactionDetailModal } from '../../components/TransactionDetailModal.js';

export function TransactionDetailScreen(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handleClose = (): void => {
    void navigate('/transactions');
  };

  return (
    <>
      <TransactionListScreen />
      <TransactionDetailModal
        transactionId={id ?? ''}
        isOpen={id !== undefined && id !== ''}
        onClose={handleClose}
      />
    </>
  );
}
