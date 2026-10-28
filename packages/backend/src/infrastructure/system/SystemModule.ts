import { Module } from '@nestjs/common';
import { SystemClock } from './SystemClock.js';
import { UuidV7Generator } from './UuidV7Generator.js';

export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

/** Wall-clock and UUIDv7 adapters for the Clock / IdGenerator ports. Import where needed. */
@Module({
  providers: [
    { provide: CLOCK, useFactory: () => new SystemClock() },
    { provide: ID_GENERATOR, useFactory: () => new UuidV7Generator() },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class SystemModule {}
