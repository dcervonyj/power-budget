import { apiClient } from '../../../../infrastructure/index.js';
import { SerialQueue } from '../../../../infrastructure/transactions/SerialQueue.js';
import { TransactionsGateway } from '../../../../infrastructure/transactions/TransactionsGateway.js';

/** The transaction endpoints on the app's API client. */
export const transactionsGateway = new TransactionsGateway(apiClient);

/**
 * Every write of a transaction (category, transfer) goes through this queue, so the server sees
 * them in the order the user made them, also across the list and the detail screen.
 */
export const writeQueue = new SerialQueue();
