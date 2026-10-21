/**
 * JWT signing configuration (CLN-001 / audit C1).
 *
 * The API must never fall back to a well-known secret: a missing or short
 * JWT_SECRET outside tests stops the process at boot instead of letting
 * anyone forge access tokens.
 */
export const JWT_ALGORITHM = 'HS256';

export const JWT_SECRET_MIN_BYTES = 32;

const TEST_ONLY_JWT_SECRET = 'test-only-jwt-secret-not-for-real-deployments';

export class InvalidJwtSecretError extends Error {
  constructor(reason: string) {
    super(
      `JWT_SECRET ${reason}. Set it to at least ${JWT_SECRET_MIN_BYTES} random bytes ` +
        '(for example `openssl rand -base64 48`).',
    );
    this.name = 'InvalidJwtSecretError';
  }
}

export function resolveJwtSecret(secret: string | undefined, nodeEnv: string | undefined): string {
  if (nodeEnv === 'test') {
    return secret !== undefined && secret.length > 0 ? secret : TEST_ONLY_JWT_SECRET;
  }
  if (secret === undefined || secret.length === 0) {
    throw new InvalidJwtSecretError('is not set');
  }
  if (Buffer.byteLength(secret, 'utf8') < JWT_SECRET_MIN_BYTES) {
    throw new InvalidJwtSecretError(`is shorter than ${JWT_SECRET_MIN_BYTES} bytes`);
  }

  return secret;
}
