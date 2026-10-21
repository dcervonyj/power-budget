import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CURRENCIES } from '@power-budget/core';
import { IsoDate } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { GetFxRatesUseCase } from '../../application/fx/use-cases/GetFxRatesUseCase.js';
import { FxRateUnavailableError } from '../../application/fx/errors.js';
import { FxRatesQueryDto, FxRatesResponseDto } from './dto/fx.dto.js';

const DEFAULT_BASE_CURRENCY = 'EUR';

/** Local pipe until CLN-002 adds the global ValidationPipe; expectedType does not rely on metadata. */
const QUERY_VALIDATION = new ValidationPipe({
  expectedType: FxRatesQueryDto,
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@ApiTags('fx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fx-rates')
export class FxController {
  constructor(private readonly getFxRates: GetFxRatesUseCase) {}

  @Get()
  @ApiOperation({ summary: 'FX reference rates for a base currency as of a date' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-10-20',
    description: 'Rates as of this date (YYYY-MM-DD). Defaults to today (UTC).',
  })
  @ApiQuery({
    name: 'base',
    required: false,
    enum: Object.keys(CURRENCIES),
    description: 'Base currency. Defaults to EUR.',
  })
  @ApiResponse({ status: 200, type: FxRatesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid date or unsupported base currency' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No rates stored within 7 days of the date' })
  async list(@Query(QUERY_VALIDATION) query: FxRatesQueryDto): Promise<FxRatesResponseDto> {
    const date = IsoDate.of(query.date ?? new Date().toISOString().slice(0, 10));
    try {
      const snapshot = await this.getFxRates.execute({
        date,
        baseCurrency: query.base ?? DEFAULT_BASE_CURRENCY,
      });

      return {
        date: snapshot.date,
        baseCurrency: snapshot.baseCurrency,
        rates: { ...snapshot.rates },
      };
    } catch (err) {
      if (err instanceof FxRateUnavailableError) {
        throw new NotFoundException('FX_RATE_UNAVAILABLE');
      }
      throw err;
    }
  }
}
