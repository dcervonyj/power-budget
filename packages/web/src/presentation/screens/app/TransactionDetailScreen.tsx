import React from 'react';
import { useParams } from 'react-router-dom';
import { TransactionListScreen } from './TransactionListScreen.js';

/** /transactions and /transactions/:id: the list, with the detail modal open over it for an id. */
export function TransactionDetailScreen(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();

  return <TransactionListScreen detailId={id} />;
}
