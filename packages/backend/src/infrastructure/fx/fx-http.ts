/** The subset of the global `fetch` the FX providers use; injected so tests never hit the network. */
export type FxHttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type FxClock = () => Date;

export const FX_HTTP_TIMEOUT_MS = 15_000;
