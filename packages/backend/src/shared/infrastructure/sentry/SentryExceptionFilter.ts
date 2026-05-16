import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { FastifyReply } from 'fastify';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only capture 5xx errors (not 4xx client errors)
    if (status >= 500) {
      Sentry.captureException(exception);
    }

    response.status(status).send({
      statusCode: status,
      message: exception instanceof HttpException ? exception.message : 'Internal server error',
    });
  }
}
