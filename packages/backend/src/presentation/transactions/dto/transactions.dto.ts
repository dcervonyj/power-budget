export class ListTransactionsQueryDto {
  accountId?: string;
  from?: string;
  to?: string;
  q?: string;
  unmappedOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export class AddManualTransactionDto {
  accountId!: string;
  occurredOn!: string;
  amountMinor!: number;
  currency!: string;
  description!: string;
  merchant?: string | null;
  notes?: string | null;
}

export class PatchTransactionDto {
  notes?: string | null;
  ignored?: boolean;
}

export class SetMappingDto {
  plannedItemId!: string | null;
}

export class MarkTransferDto {
  counterpartTransactionId?: string | null;
}

export class BulkMapDto {
  ids!: string[];
  op!: 'map' | 'transfer' | 'ignore';
  payload?: Record<string, unknown>;
}
