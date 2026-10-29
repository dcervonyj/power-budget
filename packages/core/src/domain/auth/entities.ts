import type { UserId, HouseholdId, HouseholdMemberId } from './ids.js';
import type { HouseholdRole } from './enums.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { IsoDateTime } from '../shared/ids.js';

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
