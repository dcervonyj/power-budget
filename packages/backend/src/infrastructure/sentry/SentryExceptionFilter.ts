import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { FastifyReply } from 'fastify';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import {
  codeForStatus,
  headersForDomainError,
  mapDomainError,
} from '../../presentation/http/domain-error-mapping.js';

/** Every error response has this shape; HttpException bodies may add fields (e.g. `errors`). */
export interface ErrorResponseBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly [extra: string]: unknown;
}

interface ResolvedError {
  readonly status: number;
  readonly body: ErrorResponseBody;
}

/**
 * Maps errors to HTTP responses (audit H3):
 * - HttpException: its status, and its body is kept (so `code`, `errors`,
 *   `redirectHint` reach the client); a `code` is derived from the status if absent.
 * - Known domain errors (see domain-error-mapping.ts): mapped status + code.
 * - Client errors raised by Fastify itself (`statusCode` 4xx, e.g. bad JSON).
 * - Anything else: 500 with a generic body, logged and sent to Sentry.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const { status, body } = resolveError(exception);

    // Only 5xx are captured; 4xx are expected client errors.
    if (status >= 500) {
      // Sentry may have no DSN configured — always log server errors to stdout as well.
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
      Sentry.captureException(exception);
    }

    response.status(status).headers(headersForDomainError(exception)).send(body);
  }
}

export function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }

  const domain = mapDomainError(exception);
  if (domain !== null) {
    return {
      status: domain.status,
      body: { statusCode: domain.status, code: domain.code, message: domain.message },
    };
  }

  const clientStatus = clientErrorStatus(exception);
  if (clientStatus !== null) {
    return {
      status: clientStatus,
      body: {
        statusCode: clientStatus,
        code: codeForStatus(clientStatus),
        message: exception instanceof Error ? exception.message : codeForStatus(clientStatus),
      },
    };
  }

  const status = HttpStatus.INTERNAL_SERVER_ERROR;

  return {
    status,
    body: { statusCode: status, code: codeForStatus(status), message: 'Internal server error' },
  };
}

function fromHttpException(exception: HttpException): ResolvedError {
  const status = exception.getStatus();
  const payload = exception.getResponse();

  if (typeof payload === 'string') {
    return { status, body: { statusCode: status, code: codeForStatus(status), message: payload } };
  }

  // Nest adds `error: 'Not Found'` etc.; `code` replaces it.
  const fields: Record<string, unknown> = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== 'error'),
  );
  const code = typeof fields['code'] === 'string' ? fields['code'] : codeForStatus(status);
  const message = typeof fields['message'] === 'string' ? fields['message'] : exception.message;

  return { status, body: { ...fields, statusCode: status, code, message } };
}

function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null || !('statusCode' in exception)) {
    return null;
  }
  const { statusCode } = exception;

  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : null;
}
