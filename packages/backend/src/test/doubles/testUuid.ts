import { createHash } from 'node:crypto';

/**
 * Deterministic UUID for a readable fixture label, so specs can write `PlanId.of(testUuid('ann-plan'))` and keep
 * the label in assertions while the brand constructor still gets a valid id.
 */
export function testUuid(label: string): string {
  const hex = createHash('sha1').update(label).digest('hex');

  return `01900000-${hex.slice(0, 4)}-7${hex.slice(4, 7)}-8${hex.slice(7, 10)}-${hex.slice(10, 22)}`;
}
