import type { HttpClient } from '@power-budget/shared-app/infrastructure';
import type {
  AccountDto,
  AddManualTransactionDto,
  TransactionDetailDto,
  TransactionDto,
} from '@power-budget/shared-app/contract';

/** What the Add screen sends for one expense; `plannedItemId` null leaves it unplanned. */
export interface NewExpense {
  readonly accountId: string;
  readonly occurredOn: string;
  /** Positive minor units of what was spent; sent negative (outgoing). */
  readonly spentMinor: bigint;
  readonly currency: AccountDto['currency'];
  readonly description: string;
  readonly plannedItemId: string | null;
}

/** The endpoints behind the Add screen: accounts, `POST /transactions`, mapping and undo. */
export class AddExpenseApi {
  constructor(private readonly http: HttpClient) {}

  async accounts(): Promise<AccountDto[]> {
    // eslint-disable-next-line no-restricted-syntax -- a list of the generated AccountDto
    const res = await this.http.get<AccountDto[]>('/accounts');

    return res.data;
  }

  /** Creates the outgoing transaction; mapping is a separate call so a failed map can be retried alone. */
  async create(expense: NewExpense): Promise<TransactionDto> {
    const body: AddManualTransactionDto = {
      accountId: expense.accountId,
      occurredOn: expense.occurredOn,
      amountMinor: (-expense.spentMinor).toString(),
      currency: expense.currency,
      description: expense.description,
    };
    const res = await this.http.post<TransactionDto>('/transactions', body);

    return res.data;
  }

  /** The planned item the server has the transaction mapped to, or null when it is unmapped. */
  async mappedTo(transactionId: string): Promise<string | null> {
    const res = await this.http.get<TransactionDetailDto>(`/transactions/${transactionId}`);

    return res.data.mapping === null ? null : res.data.mapping.plannedItemId;
  }

  async map(transactionId: string, plannedItemId: string): Promise<void> {
    await this.http.patch(`/transactions/${transactionId}/mapping`, { plannedItemId });
  }

  /** There is no delete: undo soft-ignores the transaction so it counts in no total. */
  async undo(transactionId: string): Promise<void> {
    await this.http.patch(`/transactions/${transactionId}`, { ignored: true });
  }
}
