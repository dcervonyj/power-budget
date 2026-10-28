/** Small synchronous string storage (browser localStorage on web). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
