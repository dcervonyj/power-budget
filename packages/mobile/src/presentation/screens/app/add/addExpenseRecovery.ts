/** An expense that was created but whose category could not be applied yet. */
export interface PendingCategory {
  readonly transactionId: string;
  readonly typed: string;
  readonly categoryId: string;
  readonly accountId: string;
}

/**
 * Lives outside the screen so the recovery survives leaving and reopening Add expense: the
 * created transaction id is kept, so retrying the category never creates the expense again.
 */
export const pendingCategory: { current: PendingCategory | null } = { current: null };
