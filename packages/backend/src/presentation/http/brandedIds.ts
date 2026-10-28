import type { Brand, IdNamespace } from '@power-budget/core';

/**
 * Brands an id that already passed a request validator (`ParseUUIDPipe`, `@IsUUID()`). Those accept any hex UUID,
 * a little looser than the core id types, so an id the core type rejects gets `notFound()` (the answer a well-formed
 * id with no row gets) instead of an unmapped `InvalidIdError` (500).
 */
export function brandOrNotFound<B extends string>(
  namespace: IdNamespace<B>,
  raw: string,
  notFound: () => Error,
): Brand<string, B> {
  if (!namespace.isValid(raw)) {
    throw notFound();
  }

  return namespace.of(raw);
}
