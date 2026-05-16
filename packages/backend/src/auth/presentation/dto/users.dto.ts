import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { LocaleCode } from '../../domain/entities.js';

export class UpdateLocaleDto {
  @ApiProperty({ type: String, enum: ['en', 'uk', 'ru', 'pl'], example: 'en' })
  @IsIn(['en', 'uk', 'ru', 'pl'])
  locale!: LocaleCode;
}
