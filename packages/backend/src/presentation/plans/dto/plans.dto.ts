import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CURRENCIES,
  MATCH_HINT_MAX_DAY_WINDOW,
  MATCH_HINT_PATTERN_MAX_LENGTH,
} from '@power-budget/core';
import type { CurrencyCode, PlannedItemMatchHint } from '@power-budget/core';
import type {
  Plan,
  PlannedItem,
  PlannedItemPatch,
  PlannedItemVersion,
  PlanPeriodKind,
  PlanType,
  PlannedDirection,
} from '../../../domain/plans/entities.js';
import type { PlanStatusFilter } from '../../../domain/plans/ports.js';
import { MoneyDto, toMoneyDto } from '../../http/money.js';
import { ISO_DATE_PATTERN, ToMinorUnitsString } from '../../http/validators.js';
import { DateRangeDto } from './plan-dashboard.dto.js';

const CURRENCY_CODES = Object.keys(CURRENCIES);
const PLAN_TYPES: readonly PlanType[] = ['personal', 'household'];
const PERIOD_KINDS: readonly PlanPeriodKind[] = ['weekly', 'monthly', 'custom'];
const DIRECTIONS: readonly PlannedDirection[] = ['income', 'expense'];
const STATUSES: readonly PlanStatusFilter[] = ['active', 'archived', 'all'];
/** Planned amounts are non-negative minor units; the direction gives the sign. */
const PLANNED_MINOR_UNITS_PATTERN = /^\d{1,18}$/;
const DATE_MESSAGE = 'must be a YYYY-MM-DD date';

// ─── Requests ───────────────────────────────────────────────────────────────

/** AI-004: how a planned item recognises its bank transaction. At least one part is required. */
export class MatchHintDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MATCH_HINT_PATTERN_MAX_LENGTH,
    example: 'landlord',
    description: 'Text found in the merchant, counterparty or description (ignores case/accents)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MATCH_HINT_PATTERN_MAX_LENGTH)
  counterpartyPattern?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '300000',
    description: 'Expected amount in minor units of the item currency',
  })
  @IsOptional()
  @ToMinorUnitsString()
  @Matches(PLANNED_MINOR_UNITS_PATTERN, {
    message: 'amountMinor must be a non-negative integer string of minor units',
  })
  amountMinor?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5000',
    description: 'Allowed deviation (plus or minus) in minor units; needs amountMinor, default 0',
  })
  @IsOptional()
  @ToMinorUnitsString()
  @Matches(PLANNED_MINOR_UNITS_PATTERN, {
    message: 'toleranceMinor must be a non-negative integer string of minor units',
  })
  toleranceMinor?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 31, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: MATCH_HINT_MAX_DAY_WINDOW,
    description: 'Allowed deviation in days; needs dayOfMonth, default 0',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MATCH_HINT_MAX_DAY_WINDOW)
  dayWindow?: number | null;
}

export class ListPlansQueryDto {
  @ApiPropertyOptional({
    enum: STATUSES,
    description: '`active` (default): not archived; `archived`; `all`',
  })
  @IsOptional()
  @IsIn(STATUSES)
  status?: PlanStatusFilter;
}

export class CreatePlanDto {
  @ApiProperty({ type: String, maxLength: 255, example: 'October budget' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: PLAN_TYPES, description: 'personal plans are visible to their owner only' })
  @IsIn(PLAN_TYPES)
  type!: PlanType;

  @ApiProperty({ enum: PERIOD_KINDS })
  @IsIn(PERIOD_KINDS)
  periodKind!: PlanPeriodKind;

  @ApiProperty({ type: String, example: '2026-10-01' })
  @Matches(ISO_DATE_PATTERN, { message: `periodStart ${DATE_MESSAGE}` })
  periodStart!: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-10-31',
    description: 'Required for custom plans; derived from the start for weekly and monthly',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: `periodEnd ${DATE_MESSAGE}` })
  periodEnd?: string;

  @ApiProperty({ type: String, enum: CURRENCY_CODES, example: 'PLN' })
  @IsIn(CURRENCY_CODES)
  baseCurrency!: CurrencyCode;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ type: String, maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-11-01',
    description: 'Moves the period; weekly and monthly plans derive the end again',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: `periodStart ${DATE_MESSAGE}` })
  periodStart?: string;

  @ApiPropertyOptional({ type: String, example: '2026-11-30' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: `periodEnd ${DATE_MESSAGE}` })
  periodEnd?: string;

  @ApiPropertyOptional({ type: String, enum: CURRENCY_CODES })
  @IsOptional()
  @IsIn(CURRENCY_CODES)
  baseCurrency?: CurrencyCode;
}

export class ClonePlanDto {
  @ApiPropertyOptional({ type: String, maxLength: 255, description: 'Defaults to the source name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-11-01',
    description: 'Defaults to the day after the source period ends',
  })
  @ValidateIf((dto: ClonePlanDto) => dto.periodStart !== undefined || dto.periodEnd !== undefined)
  @IsDefined({ message: 'periodStart is required when periodEnd is given' })
  @Matches(ISO_DATE_PATTERN, { message: `periodStart ${DATE_MESSAGE}` })
  periodStart?: string;

  @ApiPropertyOptional({ type: String, example: '2026-11-30' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: `periodEnd ${DATE_MESSAGE}` })
  periodEnd?: string;
}

export class CreatePlannedItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  categoryId!: string;

  @ApiProperty({ enum: DIRECTIONS })
  @IsIn(DIRECTIONS)
  direction!: PlannedDirection;

  @ApiProperty({
    type: String,
    example: '150000',
    description:
      'Planned amount in minor units as an integer string (a safe JSON integer is accepted)',
  })
  @ToMinorUnitsString()
  @Matches(PLANNED_MINOR_UNITS_PATTERN, {
    message: 'amountMinor must be a non-negative integer string of minor units',
  })
  amountMinor!: string;

  @ApiProperty({ type: String, enum: CURRENCY_CODES, example: 'PLN' })
  @IsIn(CURRENCY_CODES)
  currency!: CurrencyCode;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({ type: MatchHintDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchHintDto)
  matchHint?: MatchHintDto | null;
}

export class UpdatePlannedItemDto {
  @ApiPropertyOptional({
    type: String,
    example: '160000',
    description: 'Send together with currency',
  })
  @ValidateIf(
    (dto: UpdatePlannedItemDto) => dto.amountMinor !== undefined || dto.currency !== undefined,
  )
  @IsDefined({ message: 'amountMinor and currency must be sent together' })
  @ToMinorUnitsString()
  @Matches(PLANNED_MINOR_UNITS_PATTERN, {
    message: 'amountMinor must be a non-negative integer string of minor units',
  })
  amountMinor?: string;

  @ApiPropertyOptional({ type: String, enum: CURRENCY_CODES })
  @ValidateIf(
    (dto: UpdatePlannedItemDto) => dto.amountMinor !== undefined || dto.currency !== undefined,
  )
  @IsDefined({ message: 'amountMinor and currency must be sent together' })
  @IsIn(CURRENCY_CODES)
  currency?: CurrencyCode;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({
    type: MatchHintDto,
    nullable: true,
    description: 'null clears the hint',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchHintDto)
  matchHint?: MatchHintDto | null;

  @ApiPropertyOptional({ type: String, maxLength: 500, description: 'Stored in the item history' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ─── Responses ──────────────────────────────────────────────────────────────

export class PlanDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, maxLength: 255 })
  name!: string;

  @ApiProperty({ enum: PLAN_TYPES })
  type!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Set for personal plans',
  })
  ownerUserId!: string | null;

  @ApiProperty({ enum: PERIOD_KINDS })
  periodKind!: string;

  @ApiProperty({ type: DateRangeDto })
  period!: DateRangeDto;

  @ApiProperty({ type: String, example: 'PLN' })
  baseCurrency!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlannedItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  planId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ enum: DIRECTIONS })
  direction!: string;

  @ApiProperty({ type: MoneyDto })
  amount!: MoneyDto;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: MatchHintDto, nullable: true })
  matchHint!: MatchHintDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlannedItemChangeDto {
  @ApiPropertyOptional({ type: MoneyDto })
  amount?: MoneyDto;

  @ApiPropertyOptional({ type: String, nullable: true })
  note?: string | null;

  @ApiPropertyOptional({ type: MatchHintDto, nullable: true })
  matchHint?: MatchHintDto | null;
}

export class PlannedItemVersionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  plannedItemId!: string;

  @ApiProperty({
    type: PlannedItemChangeDto,
    nullable: true,
    description: 'Values before the change',
  })
  before!: PlannedItemChangeDto | null;

  @ApiProperty({ type: PlannedItemChangeDto, description: 'Values after the change' })
  after!: PlannedItemChangeDto;

  @ApiProperty({ type: String, format: 'uuid' })
  changedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  changedAt!: string;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;
}

export function toPlanDto(plan: Plan): PlanDto {
  return {
    id: plan.id,
    name: plan.name,
    type: plan.type,
    ownerUserId: plan.ownerUserId,
    periodKind: plan.periodKind,
    period: { start: plan.period.start, end: plan.period.end },
    baseCurrency: plan.baseCurrency,
    archivedAt: plan.archivedAt,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function toPlannedItemDto(item: PlannedItem): PlannedItemDto {
  return {
    id: item.id,
    planId: item.planId,
    categoryId: item.categoryId,
    direction: item.direction,
    amount: toMoneyDto(item.amount),
    note: item.note,
    matchHint: toMatchHintDto(item.matchHint),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toPlannedItemVersionDto(version: PlannedItemVersion): PlannedItemVersionDto {
  return {
    id: version.id,
    plannedItemId: version.plannedItemId,
    before: version.before === null ? null : toPlannedItemChangeDto(version.before),
    after: toPlannedItemChangeDto(version.after),
    changedBy: version.changedBy,
    changedAt: version.changedAt,
    reason: version.reason,
  };
}

function toPlannedItemChangeDto(change: Partial<PlannedItemPatch>): PlannedItemChangeDto {
  return {
    ...(change.amount !== undefined ? { amount: toMoneyDto(change.amount) } : {}),
    ...(change.note !== undefined ? { note: change.note } : {}),
    ...(change.matchHint !== undefined ? { matchHint: toMatchHintDto(change.matchHint) } : {}),
  };
}

export function toMatchHintDto(hint: PlannedItemMatchHint | null): MatchHintDto | null {
  if (hint === null) {
    return null;
  }

  return {
    counterpartyPattern: hint.counterpartyPattern,
    amountMinor: hint.amount === null ? null : hint.amount.amountMinor.toString(),
    toleranceMinor: hint.amount === null ? null : hint.amount.toleranceMinor.toString(),
    dayOfMonth: hint.day === null ? null : hint.day.dayOfMonth,
    dayWindow: hint.day === null ? null : hint.day.window,
  };
}

/** Throws HttpException(400) for a hint with no part set; null (clear) passes through. */
export function matchHintFromDto(dto: MatchHintDto | null): PlannedItemMatchHint | null {
  if (dto === null) {
    return null;
  }
  const pattern = dto.counterpartyPattern?.trim() ?? '';
  const amountMinor = dto.amountMinor ?? null;
  const dayOfMonth = dto.dayOfMonth ?? null;
  const hasAmount = amountMinor !== null;
  const hasDay = dayOfMonth !== null;
  if (pattern === '' && !hasAmount && !hasDay) {
    throw new BadRequestException(
      'matchHint needs a counterpartyPattern, amountMinor or dayOfMonth',
    );
  }

  if (!hasAmount && dto.toleranceMinor !== undefined && dto.toleranceMinor !== null) {
    throw new BadRequestException('matchHint toleranceMinor needs an amountMinor');
  }
  if (!hasDay && dto.dayWindow !== undefined && dto.dayWindow !== null) {
    throw new BadRequestException('matchHint dayWindow needs a dayOfMonth');
  }

  return {
    counterpartyPattern: pattern === '' ? null : pattern,
    amount: hasAmount
      ? { amountMinor: BigInt(amountMinor), toleranceMinor: BigInt(dto.toleranceMinor ?? '0') }
      : null,
    day: hasDay ? { dayOfMonth, window: dto.dayWindow ?? 0 } : null,
  };
}
