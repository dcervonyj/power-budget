import type { UserId, HouseholdId, HouseholdMemberId } from './ids.js';
import type { HouseholdRole } from './enums.js';
import type { LocaleCode } from '../shared/locale.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { IsoDateTime } from '../shared/ids.js';

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly locale: LocaleCode;
  readonly baseCurrency: CurrencyCode;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface Household {
  readonly id: HouseholdId;
  readonly name: string;
  readonly baseCurrency: CurrencyCode;
  readonly createdAt: IsoDateTime;
}

export interface HouseholdMember {
  readonly id: HouseholdMemberId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly role: HouseholdRole;
  readonly joinedAt: IsoDateTime;
}
