import type { HttpClient, HouseholdsApi } from '@power-budget/shared-app';
import type {
  AccountDto,
  BankConnectionDto,
  HouseholdMemberResponseDto,
  TransactionPageDto,
  UserProfileDto,
} from '@power-budget/shared-app/contract';
import type { ShellApi } from '../../application/shell/ShellStore.js';

/** Transactions read to count the ones to sort: the badge shows up to 99, then "99+". */
export const TO_SORT_PAGE = 100;

/** The app shell's reads over HTTP (DSN-017). */
export class HttpShellApi implements ShellApi {
  constructor(
    private readonly http: HttpClient,
    private readonly households: Pick<HouseholdsApi, 'members'>,
  ) {}

  async profile(): Promise<UserProfileDto> {
    const response = await this.http.get<UserProfileDto>('/users/me');

    return response.data;
  }

  members(): Promise<HouseholdMemberResponseDto[]> {
    return this.households.members();
  }

  async toSortPage(): Promise<TransactionPageDto> {
    const response = await this.http.get<TransactionPageDto>(
      `/transactions?unmappedOnly=true&limit=${String(TO_SORT_PAGE)}`,
    );

    return response.data;
  }

  async bankConnections(): Promise<BankConnectionDto[]> {
    const response = await this.http.get<BankConnectionDto[]>('/bank-connections');

    return response.data;
  }

  async accounts(): Promise<AccountDto[]> {
    const response = await this.http.get<AccountDto[]>('/accounts');

    return response.data;
  }
}
