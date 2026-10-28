import type { IdGenerator } from '../../domain/shared/ports.js';

/** Deterministic v7-shaped ids: 00000000-0000-7000-8000-000000000001, ...02, ... */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;

    return SequentialIdGenerator.idAt(this.counter);
  }

  static idAt(n: number): string {
    return `00000000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
  }
}
