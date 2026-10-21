import { BadRequestException, ValidationPipe, type Provider } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import type { ValidationError } from 'class-validator';

export const VALIDATION_FAILED_CODE = 'validation_failed';

export interface FieldError {
  /** Dotted path of the offending property, e.g. `items.0.amountMinor`. */
  readonly field: string;
  readonly messages: string[];
}

/**
 * Global request validation (audit C5): unknown properties are rejected,
 * payloads are turned into DTO instances so `@Type` conversions apply.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: toValidationException,
  });
}

/** Registered as APP_PIPE so every module (and the HTTP test app) gets the same pipe. */
export const validationPipeProvider: Provider = {
  provide: APP_PIPE,
  useFactory: createValidationPipe,
};

export function toValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_FAILED_CODE,
    message: 'Validation failed',
    errors: flattenValidationErrors(errors, ''),
  });
}

function flattenValidationErrors(errors: ValidationError[], parentPath: string): FieldError[] {
  return errors.flatMap((error) => flattenValidationError(error, parentPath));
}

function flattenValidationError(error: ValidationError, parentPath: string): FieldError[] {
  const field = parentPath === '' ? error.property : `${parentPath}.${error.property}`;
  const own: FieldError[] = error.constraints
    ? [{ field, messages: Object.values(error.constraints) }]
    : [];

  return [...own, ...flattenValidationErrors(error.children ?? [], field)];
}
