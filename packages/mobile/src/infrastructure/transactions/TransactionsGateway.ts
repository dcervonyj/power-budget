import type { HttpClient } from '@power-budget/shared-app';
import type {
  PatchTransactionDto,
  SetMappingDto,
  TransactionDetailDto,
  TransactionPageDto,
} from '@power-budget/shared-app/contract';

const PAGE_SIZE = 50;

/** The transaction endpoints the list and the detail screens use. */
export class TransactionsGateway {
  constructor(private readonly http: HttpClient) {}

  async page(cursor?: string): Promise<TransactionPageDto> {
    const query = cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`;
    const response = await this.http.get<TransactionPageDto>(
      `/transactions?limit=${PAGE_SIZE}${query}`,
    );

    return response.data;
  }

  async detail(id: string): Promise<TransactionDetailDto> {
    const response = await this.http.get<TransactionDetailDto>(`/transactions/${id}`);

    return response.data;
  }

  /** Maps the transaction to a planned item; null clears the mapping. */
  async setMapping(id: string, plannedItemId: string | null): Promise<void> {
    const body: SetMappingDto = { plannedItemId };
    await this.http.patch(`/transactions/${id}/mapping`, body);
  }

  async setNotes(id: string, notes: string | null): Promise<void> {
    const body: PatchTransactionDto = { notes };
    await this.http.patch(`/transactions/${id}`, body);
  }

  async setTransfer(id: string, isTransfer: boolean): Promise<void> {
    if (isTransfer) {
      await this.http.request({ url: `/transactions/${id}/transfer`, method: 'POST', body: {} });

      return;
    }
    await this.http.request({ url: `/transactions/${id}/transfer`, method: 'DELETE' });
  }
}
