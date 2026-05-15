import { IsIn } from 'class-validator';
import type { LocaleCode } from '../../../domain/auth/entities.js';

export class UpdateLocaleDto {
  @IsIn(['en', 'uk', 'ru', 'pl'])
  locale!: LocaleCode;
}
