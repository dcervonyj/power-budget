import { apiClient } from '../../../../infrastructure/index.js';
import { TransactionsGateway } from '../../../../infrastructure/transactions/TransactionsGateway.js';

/** The transaction endpoints on the app's API client. */
export const transactionsGateway = new TransactionsGateway(apiClient);
