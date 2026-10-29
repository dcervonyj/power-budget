/** Per-tab storage for wizard progress. Implementations never throw: a failure is a no-op. */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
