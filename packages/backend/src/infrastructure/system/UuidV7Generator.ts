import { uuidv7 } from 'uuidv7';
import type { IdGenerator } from '../../domain/shared/ports.js';

export class UuidV7Generator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
