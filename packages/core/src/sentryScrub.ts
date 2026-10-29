/** Remove query values, including unknown provider-specific callback parameters. */
export function scrubSentryUrl(url: string): string {
  return url
    .replace(/([?&][^=&#\s]+)=([^&#\s]*)/g, '$1=[Filtered]')
    .replace(/#[^\s]*/g, '#[Filtered]');
}

export function scrubSentryText(text: string): string {
  return scrubSentryUrl(text)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[Filtered]')
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi, '[Filtered]')
    .replace(/\b(?:\d[ -]?){8,}\b/g, '[Filtered]')
    .replace(/\bBearer\s+[^\s,;]+/gi, '[Filtered]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Filtered]');
}

interface ScrubBreadcrumb {
  category?: string | undefined;
  level?: string | undefined;
  type?: string | undefined;
  timestamp?: number | undefined;
  message?: string | undefined;
  data?: Record<string, unknown> | undefined;
}
interface ScrubRequest {
  url?: string | undefined;
  data?: unknown;
  cookies?: unknown;
  headers?: unknown;
  query_string?: unknown;
  env?: unknown;
}
interface ScrubFrame {
  filename?: string | undefined;
  function?: string | undefined;
  module?: string | undefined;
  lineno?: number | undefined;
  colno?: number | undefined;
  in_app?: boolean | undefined;
  abs_path?: string | undefined;
  vars?: unknown;
  pre_context?: unknown;
  context_line?: unknown;
  post_context?: unknown;
}
interface ScrubEvent {
  user?: unknown;
  request?: ScrubRequest | undefined;
  breadcrumbs?: ScrubBreadcrumb[] | undefined;
  message?: string | undefined;
  extra?: unknown;
  contexts?: Record<string, unknown> | undefined;
  exception?:
    | {
        values?:
          | {
              value?: string | undefined;
              stacktrace?: { frames?: ScrubFrame[] | undefined } | undefined;
            }[]
          | undefined;
      }
    | undefined;
  logentry?: { message?: string | undefined } | undefined;
}
interface ScrubSpan {
  description?: string | undefined;
  data?: Record<string, unknown> | undefined;
}
interface ScrubTransaction extends ScrubEvent {
  transaction?: string | undefined;
  spans?: ScrubSpan[] | undefined;
}

export function scrubSentryBreadcrumb<B extends ScrubBreadcrumb>(breadcrumb: B): B {
  if (breadcrumb.message) {
    breadcrumb.message = scrubSentryText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    const data = breadcrumb.data;
    const safe: Record<string, unknown> = {};
    for (const key of ['url', 'from', 'to']) {
      const value = data[key];
      if (typeof value === 'string') {
        safe[key] = scrubSentryUrl(value);
      }
    }
    for (const key of ['method', 'status_code']) {
      const value = data[key];
      if (
        typeof value === 'number' ||
        (key === 'method' &&
          typeof value === 'string' &&
          /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(value))
      ) {
        safe[key] = value;
      }
    }
    breadcrumb.data = safe;
  }

  return breadcrumb;
}

export function scrubSentryEvent<E extends ScrubEvent>(event: E): E {
  delete event.user;
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubSentryUrl(event.request.url);
    }
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    delete event.request.env;
  }
  if (event.message) {
    event.message = scrubSentryText(event.message);
  }
  if (event.logentry?.message) {
    event.logentry.message = scrubSentryText(event.logentry.message);
  }
  delete event.extra;
  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      if (!['os', 'browser', 'runtime', 'app', 'device', 'trace'].includes(key)) {
        delete event.contexts[key];
      }
    }
  }
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = scrubSentryText(exception.value);
      }
      if (exception.stacktrace?.frames) {
        for (const frame of exception.stacktrace.frames) {
          if (frame.abs_path) {
            frame.abs_path = scrubSentryUrl(frame.abs_path);
          }
          delete frame.vars;
          delete frame.pre_context;
          delete frame.context_line;
          delete frame.post_context;
        }
      }
    }
  }
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      scrubSentryBreadcrumb(breadcrumb);
    }
  }

  return event;
}

export function scrubSentryTransaction<T extends ScrubTransaction>(event: T): T {
  scrubSentryEvent(event);
  if (event.transaction) {
    event.transaction = scrubSentryText(event.transaction);
  }
  if (event.spans) {
    for (const span of event.spans) {
      if (span.description) {
        span.description = scrubSentryText(span.description);
      }
      if (span.data) {
        for (const key of Object.keys(span.data)) {
          const value = span.data[key];
          if (key === 'http.query' || key === 'url.query') {
            if (typeof value === 'string') {
              span.data[key] = scrubSentryUrl(`?${value}`).slice(1);
            } else {
              delete span.data[key];
            }
          } else if (typeof value === 'string') {
            span.data[key] = scrubSentryText(value);
          }
        }
      }
    }
  }

  return event;
}
