import type { Clock } from '../../domain/shared/ports.js';

/** Clock fixed at a given instant; advance it explicitly. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(instant: Date | string) {
    this.current = new Date(instant);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
