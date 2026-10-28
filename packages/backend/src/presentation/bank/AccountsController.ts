import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { ListAccountsUseCase } from '../../application/bank/use-cases/ListAccountsUseCase.js';
import { CreateManualAccountUseCase } from '../../application/bank/use-cases/CreateManualAccountUseCase.js';
import { AccountDto, CreateManualAccountDto, toAccountDto } from './dto/accounts.dto.js';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(
    private readonly listAccounts: ListAccountsUseCase,
    private readonly createManualAccount: CreateManualAccountUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's own accounts (bank and manual)",
    description:
      "A partner's accounts are never listed: accounts are private to their owner; the partner's spending is shared only through category totals.",
  })
  @ApiResponse({ status: 200, description: 'Own accounts', type: [AccountDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<AccountDto[]> {
    if (!user.householdId) {
      return [];
    }

    const accounts = await this.listAccounts.execute({
      userId: user.userId,
      householdId: user.householdId,
    });

    return accounts.map(toAccountDto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a manual (cash) account for manual transactions' })
  @ApiBody({ type: CreateManualAccountDto })
  @ApiResponse({ status: 201, description: 'Account created', type: AccountDto })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'The caller has no household' })
  async create(
    @Body() dto: CreateManualAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountDto> {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    const account = await this.createManualAccount.execute({
      userId: user.userId,
      householdId: user.householdId,
      name: dto.name,
      currency: dto.currency,
    });

    return toAccountDto(account);
  }
}
