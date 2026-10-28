import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  CategoryId,
  HouseholdId,
  IsoDate,
  PlannedItemId,
  TransactionId,
  UserId,
  MerchantRuleId,
} from '@power-budget/core';
import type { MerchantRule } from '../../../domain/categorisation/entities.js';
import type {
  MerchantRuleRepository,
  PlannedItemResolver,
} from '../../../domain/categorisation/ports.js';
import type { NewTransaction, Transaction } from '../../../domain/transactions/entities.js';
import { LearnMerchantRuleUseCase } from '../LearnMerchantRuleUseCase.js';
import { SuggestFromMerchantRulesUseCase } from '../SuggestFromMerchantRulesUseCase.js';

const householdId = 'hh-1' as HouseholdId;
const userId = 'u-1' as UserId;
const categoryId = 'cat-groceries' as CategoryId;
const octoberItem = 'item-oct' as PlannedItemId;
const novemberItem = 'item-nov' as PlannedItemId;
const now = new Date('2026-10-20T10:00:00Z');

function bank(counterpartyName: string): Transaction['bank'] {
  return {
    bookingDate: null,
    valueDate: null,
    transactionAt: null,
    counterpartyName,
    counterpartyIbanHash: null,
    remittance: null,
    mcc: null,
    bankTxCode: null,
    entryReference: null,
    fingerprint: null,
    originalAmount: null,
  };
}

function rule(overrides: Partial<MerchantRule> = {}): MerchantRule {
  return {
    id: 'rule-1' as MerchantRuleId,
    householdId,
    ownerUserId: userId,
    matchKind: 'merchant',
    pattern: 'biedronka',
    categoryId,
    planKindPref: 'household',
    alwaysAsk: false,
    hits: 1,
    lastHitAt: now,
    createdFromTx: null,
    createdBy: userId,
    ...overrides,
  };
}

function newTx(occurredOn: string, overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    householdId,
    occurredOn: occurredOn as IsoDate,
    amount: { amountMinor: -4500n, currency: 'PLN' },
    description: 'Biedronka',
    merchant: null,
    ignored: false,
    bank: bank('Biedronka'),
    ...overrides,
  } as unknown as NewTransaction;
}

describe('LearnMerchantRuleUseCase', () => {
  let rules: ReturnType<typeof mock<MerchantRuleRepository>>;
  let items: ReturnType<typeof mock<PlannedItemResolver>>;
  let useCase: LearnMerchantRuleUseCase;
  const warn = vi.fn();
  const transaction = {
    id: 'tx-1' as TransactionId,
    description: 'Biedronka',
    merchant: null,
    bank: bank('Biedronka'),
  } as unknown as Transaction;

  beforeEach(() => {
    rules = mock<MerchantRuleRepository>();
    items = mock<PlannedItemResolver>();
    useCase = new LearnMerchantRuleUseCase(rules, items, () => now, warn);
  });

  it('logs and swallows a failure so the saved mapping stays', async () => {
    items.describe.mockRejectedValue(new Error('boom'));

    await useCase.learnFromMapping({
      transaction,
      plannedItemId: octoberItem,
      by: userId,
      householdId,
    });

    expect(warn).toHaveBeenCalledWith('Merchant memory skipped for tx-1: Error: boom');
  });

  it('upserts a rule with the category and plan kind of the mapped planned item', async () => {
    items.describe.mockResolvedValue({ categoryId, planKind: 'household' });

    await useCase.learnFromMapping({
      transaction,
      plannedItemId: octoberItem,
      by: userId,
      householdId,
    });

    expect(rules.recordCorrection).toHaveBeenCalledWith({
      householdId,
      ownerUserId: userId,
      keys: [{ matchKind: 'merchant', pattern: 'biedronka' }],
      categoryId,
      planKindPref: 'household',
      alwaysAsk: false,
      createdFromTx: 'tx-1',
      by: userId,
      at: now,
    });
  });

  it('learns nothing when the planned item is not in the household', async () => {
    items.describe.mockResolvedValue(null);

    await useCase.learnFromMapping({
      transaction,
      plannedItemId: octoberItem,
      by: userId,
      householdId,
    });

    expect(rules.recordCorrection).not.toHaveBeenCalled();
  });
});

describe('SuggestFromMerchantRulesUseCase', () => {
  let rules: ReturnType<typeof mock<MerchantRuleRepository>>;
  let items: ReturnType<typeof mock<PlannedItemResolver>>;
  let useCase: SuggestFromMerchantRulesUseCase;

  beforeEach(() => {
    rules = mock<MerchantRuleRepository>();
    items = mock<PlannedItemResolver>();
    useCase = new SuggestFromMerchantRulesUseCase(rules, items);
  });

  it('suggests the planned item of the plan active on the transaction date (plan rollover)', async () => {
    rules.findMatching.mockResolvedValue([rule()]);
    items.resolveActive.mockImplementation((query) =>
      Promise.resolve({
        plannedItemId: query.occurredOn.startsWith('2026-11') ? novemberItem : octoberItem,
      }),
    );

    const [oct, nov] = await useCase.suggest(
      [newTx('2026-10-05'), newTx('2026-11-03')],
      userId,
      householdId,
    );

    expect(oct?.suggestion?.suggestedPlannedItemId).toBe(octoberItem);
    expect(nov?.suggestion).toEqual({
      suggestedPlannedItemId: novemberItem,
      suggestedCategoryId: categoryId,
      suggestionConfidence: 0.8,
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    });
    expect(items.resolveActive).toHaveBeenCalledWith({
      householdId,
      ownerUserId: userId,
      categoryId,
      planKindPref: 'household',
      direction: 'expense',
      occurredOn: '2026-11-03',
    });
  });

  it('suggests only the category when no plan covers the date', async () => {
    rules.findMatching.mockResolvedValue([rule({ hits: 3 })]);
    items.resolveActive.mockResolvedValue(null);

    const [row] = await useCase.suggest([newTx('2027-02-01')], userId, householdId);

    expect(row?.suggestion).toEqual({
      suggestedPlannedItemId: null,
      suggestedCategoryId: categoryId,
      suggestionConfidence: 0.9,
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    });
  });

  it('does not suggest for an always_ask rule, an unknown merchant or an ignored row', async () => {
    rules.findMatching.mockResolvedValueOnce([rule({ alwaysAsk: true })]);
    rules.findMatching.mockResolvedValueOnce([]);
    const input = [
      newTx('2026-11-03'),
      newTx('2026-11-03'),
      newTx('2026-11-03', { ignored: true }),
    ];

    const result = await useCase.suggest(input, userId, householdId);

    expect(result.map((row) => row.suggestion)).toEqual([undefined, undefined, undefined]);
    expect(items.resolveActive).not.toHaveBeenCalled();
  });

  it('resolves a rule once per date for repeated rows of a batch', async () => {
    rules.findMatching.mockResolvedValue([rule()]);
    items.resolveActive.mockResolvedValue({ plannedItemId: novemberItem });

    await useCase.suggest([newTx('2026-11-03'), newTx('2026-11-03')], userId, householdId);

    expect(items.resolveActive).toHaveBeenCalledOnce();
  });
});
