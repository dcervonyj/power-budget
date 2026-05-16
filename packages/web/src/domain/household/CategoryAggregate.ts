export type PrivacyLevel = 'total' | 'total_and_count' | 'full_detail';

export interface TransactionSummary {
  id: string;
  date: string; // ISO date
  description: string;
  amountMinor: number; // NO accountId field
  currency: string;
}

export interface CategoryAggregate {
  categoryId: string;
  categoryName: string;
  privacyLevel: PrivacyLevel;
  totalMinor: number;
  currency: string;
  transactionCount?: number; // present for total_and_count + full_detail
  transactions?: TransactionSummary[]; // present only for full_detail
}
