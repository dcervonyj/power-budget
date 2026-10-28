/** The slice of the Sentry SDK the reporter uses; `loadSentry.ts` adapts the real one. */
export interface SentryModule {
  init(dsn: string): void;
  captureException(error: unknown): void;
}

export interface ErrorTarget {
  addEventListener(type: 'error' | 'unhandledrejection', listener: (event: Event) => void): void;
  removeEventListener(type: 'error' | 'unhandledrejection', listener: (event: Event) => void): void;
}

/**
 * Loads Sentry through a dynamic import only when a DSN is configured, so the SDK stays out of
 * the entry chunk (and out of the page entirely without a DSN).
 *
 * Errors raised before the SDK has loaded are queued (window errors, unhandled rejections and
 * errors passed to `capture`) and flushed to Sentry once it is ready; they are not dropped.
 * If the SDK fails to load, the queue is discarded and the errors stay in the console only.
 */
export class SentryReporter {
  private readonly queue: unknown[] = [];
  private sentry: SentryModule | undefined;
  private started = false;

  constructor(
    private readonly loadSentry: () => Promise<SentryModule>,
    private readonly target: ErrorTarget,
  ) {}

  get enabled(): boolean {
    return this.started;
  }

  /** Starts loading Sentry; resolves once initialised (or immediately without a DSN). */
  async start(dsn: string | undefined): Promise<void> {
    if (!dsn || this.started) {
      return;
    }
    this.started = true;
    this.target.addEventListener('error', this.onWindowError);
    this.target.addEventListener('unhandledrejection', this.onRejection);
    try {
      const sentry = await this.loadSentry();
      sentry.init(dsn);
      this.sentry = sentry;
      this.queue.splice(0).forEach((error) => sentry.captureException(error));
    } catch {
      this.queue.length = 0;
    } finally {
      // Once initialised Sentry installs its own global handlers.
      this.target.removeEventListener('error', this.onWindowError);
      this.target.removeEventListener('unhandledrejection', this.onRejection);
    }
  }

  /** Reports a caught error (for example from a React error boundary). */
  capture(error: unknown): void {
    if (!this.started) {
      return;
    }
    if (this.sentry) {
      this.sentry.captureException(error);

      return;
    }
    this.queue.push(error);
  }

  private readonly onWindowError = (event: Event): void => {
    this.queue.push('error' in event ? event.error : event);
  };

  private readonly onRejection = (event: Event): void => {
    this.queue.push('reason' in event ? event.reason : event);
  };
}
