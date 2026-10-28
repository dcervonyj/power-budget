/** Source of the current instant. Use cases read time only through this port. */
export interface Clock {
  now(): Date;
}

/** Source of new entity ids (UUIDv7, time-ordered). */
export interface IdGenerator {
  next(): string;
}
