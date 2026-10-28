/** Runs async tasks one after another, so requests reach the server in the order they were made. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(this.ignore);

    return result;
  }

  private ignore(): void {
    // A failed task must not block the ones queued behind it.
  }
}
