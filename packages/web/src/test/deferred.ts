/** A promise the test settles by hand (the TS lib target has no Promise.withResolvers). */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = noop;
  let reject: (reason: unknown) => void = noop;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return { promise, resolve, reject };
}

function noop(): void {
  // Replaced by the executor, which runs synchronously.
}
