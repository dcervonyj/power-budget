import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import type { FastifyReply } from 'fastify';
import { mock } from 'vitest-mock-extended';
import * as Sentry from '@sentry/node';
import { SentryExceptionFilter, resolveError } from '../SentryExceptionFilter.js';
import {
  InvalidCredentialsError,
  TotpEnrollmentRequiredError,
  TotpRequiredError,
} from '../../../domain/auth/errors.js';
import { BankConnectionInvalidStateError } from '../../../domain/bank/errors.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';
import { toValidationException } from '../../../presentation/http/validation.js';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

describe('resolveError', () => {
  it('maps bad credentials to 401 invalid_credentials', () => {
    expect(resolveError(new InvalidCredentialsError())).toEqual({
      status: 401,
      body: { statusCode: 401, code: 'invalid_credentials', message: 'Invalid credentials' },
    });
  });

  it('maps a missing TOTP at login to 403 requires_totp', () => {
    expect(resolveError(new TotpRequiredError())).toEqual({
      status: 403,
      body: { statusCode: 403, code: 'requires_totp', message: 'TOTP code required' },
    });
  });

  it('maps TOTP enrollment required to 403 requires_totp_enrollment', () => {
    expect(resolveError(new TotpEnrollmentRequiredError())).toEqual({
      status: 403,
      body: {
        statusCode: 403,
        code: 'requires_totp_enrollment',
        message: 'TOTP enrollment required',
      },
    });
  });

  it('maps a not-found domain error to 404 with its code', () => {
    expect(resolveError(new TransactionNotFoundError())).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'transaction_not_found', message: 'Transaction not found' },
    });
  });

  it('maps a prefixed plain error and does not leak the detail after the prefix', () => {
    const error = new Error('PLAN_NOT_FOUND: Plan p-1 not found in household h-1');

    expect(resolveError(error)).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'plan_not_found', message: 'Plan not found' },
    });
  });

  it('maps an invalid bank connection state to 409', () => {
    const error = new BankConnectionInvalidStateError(
      'Cannot reconnect a connection with status: active',
    );

    expect(resolveError(error)).toEqual({
      status: 409,
      body: {
        statusCode: 409,
        code: 'bank_connection_invalid_state',
        message: 'Cannot reconnect a connection with status: active',
      },
    });
  });

  it('keeps the code and extra fields of an HttpException object body', () => {
    const exception = new ForbiddenException({
      code: 'requires_totp_enrollment',
      redirectHint: '/auth/totp/enroll',
    });

    expect(resolveError(exception)).toEqual({
      status: 403,
      body: {
        statusCode: 403,
        code: 'requires_totp_enrollment',
        message: 'Forbidden Exception',
        redirectHint: '/auth/totp/enroll',
      },
    });
  });

  it('derives the code from the status for an HttpException with a string message', () => {
    expect(resolveError(new NotFoundException('Household not found'))).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'not_found', message: 'Household not found' },
    });
  });

  it('keeps validation field errors with code validation_failed', () => {
    const exception = toValidationException([
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
    ]);

    expect(resolveError(exception)).toEqual({
      status: 400,
      body: {
        statusCode: 400,
        code: 'validation_failed',
        message: 'Validation failed',
        errors: [{ field: 'email', messages: ['email must be an email'] }],
      },
    });
  });

  it('uses the status of Fastify client errors such as malformed JSON', () => {
    const fastifyError = Object.assign(new Error('Unexpected token } in JSON'), {
      statusCode: 400,
    });

    expect(resolveError(fastifyError)).toEqual({
      status: 400,
      body: { statusCode: 400, code: 'bad_request', message: 'Unexpected token } in JSON' },
    });
  });

  it('turns unknown errors into a generic 500', () => {
    expect(resolveError(new Error('connection refused at 10.0.0.1'))).toEqual({
      status: 500,
      body: { statusCode: 500, code: 'internal_server_error', message: 'Internal server error' },
    });
    expect(resolveError('not even an error')).toEqual({
      status: 500,
      body: { statusCode: 500, code: 'internal_server_error', message: 'Internal server error' },
    });
  });
});

describe('SentryExceptionFilter', () => {
  const reply = mock<FastifyReply>();
  const status = reply.status;
  const send = reply.send;
  const httpHost = mock<HttpArgumentsHost>();
  const host = mock<ArgumentsHost>();
  const filter = new SentryExceptionFilter();

  beforeEach(() => {
    vi.clearAllMocks();
    status.mockReturnValue(reply);
    httpHost.getResponse.mockReturnValue(reply);
    host.switchToHttp.mockReturnValue(httpHost);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('sends the mapped body and does not report 4xx to Sentry', () => {
    filter.catch(new BadRequestException('bad'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ statusCode: 400, code: 'bad_request', message: 'bad' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports unknown errors to Sentry and answers 500', () => {
    const error = new Error('boom');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
