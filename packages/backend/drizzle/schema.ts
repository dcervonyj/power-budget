import {
  pgTable,
  uuid,
  varchar,
  text,
  char,
  bigint,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ─── Auth ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull().default(''),
    localePreference: varchar('locale_preference', { length: 10 }),
    defaultLocale: varchar('default_locale', { length: 10 }).notNull().default('en'),
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);

export const households = pgTable('households', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  baseCurrency: char('base_currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdUsers = pgTable(
  'household_users',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    index('household_users_user_idx').on(t.userId),
  ],
);

export const authMethods = pgTable(
  'auth_methods',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: varchar('kind', { length: 20 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auth_methods_user_idx').on(t.userId),
    uniqueIndex('auth_methods_google_unique')
      .on(t.kind, t.providerSubject)
      .where(sql`kind = 'google'`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_token_hash_idx').on(t.refreshTokenHash),
    uniqueIndex('sessions_token_hash_unique').on(t.refreshTokenHash),
  ],
);

export const totpSecrets = pgTable('totp_secrets', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  encryptedSecret: text('encrypted_secret').notNull(),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});

export const magicLinkTokens = pgTable('magic_link_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdInvites = pgTable(
  'household_invites',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    email: varchar('email', { length: 320 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('household_invites_token_idx').on(t.tokenHash),
    uniqueIndex('household_invites_token_unique').on(t.tokenHash),
  ],
);

// ─── Bank ────────────────────────────────────────────────────────────────────

export const bankConnections = pgTable(
  'bank_connections',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: varchar('provider', { length: 30 }).notNull(),
    bankId: varchar('bank_id', { length: 100 }).notNull(),
    externalConsentRef: varchar('external_consent_ref', { length: 255 }),
    encryptedConsent: text('encrypted_consent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_connections_household_idx').on(t.householdId),
    index('bank_connections_user_status_idx').on(t.userId, t.status),
    uniqueIndex('bank_connections_consent_ref_unique').on(t.userId, t.externalConsentRef),
  ],
);

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => bankConnections.id),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    iban: varchar('iban', { length: 34 }),
    currency: char('currency', { length: 3 }).notNull(),
    balanceMinor: bigint('balance_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_accounts_connection_idx').on(t.connectionId),
    uniqueIndex('bank_accounts_external_unique').on(t.connectionId, t.externalId),
  ],
);

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => bankAccounts.id),
    externalId: varchar('external_id', { length: 255 }),
    occurredOn: date('occurred_on').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    description: text('description').notNull().default(''),
    merchant: varchar('merchant', { length: 255 }),
    source: varchar('source', { length: 20 }).notNull().default('bank_sync'),
    ignored: boolean('ignored').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_household_date_idx').on(t.householdId, t.occurredOn),
    index('transactions_account_date_idx').on(t.accountId, t.occurredOn),
    uniqueIndex('transactions_external_unique')
      .on(t.accountId, t.externalId)
      .where(sql`external_id IS NOT NULL`),
  ],
);

export const transactionMappings = pgTable(
  'transaction_mappings',
  {
    transactionId: uuid('transaction_id')
      .primaryKey()
      .references(() => transactions.id),
    plannedItemId: uuid('planned_item_id').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    mappedBy: uuid('mapped_by')
      .notNull()
      .references(() => users.id),
    mappedAt: timestamp('mapped_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mappings_planned_item_idx').on(t.plannedItemId)],
);

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    txAId: uuid('tx_a_id')
      .notNull()
      .references(() => transactions.id),
    txBId: uuid('tx_b_id').references(() => transactions.id),
    markedBy: uuid('marked_by')
      .notNull()
      .references(() => users.id),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transfers_tx_a_idx').on(t.txAId),
    index('transfers_tx_b_idx').on(t.txBId),
    uniqueIndex('transfers_tx_a_unique').on(t.txAId),
    uniqueIndex('transfers_tx_b_unique').on(t.txBId),
  ],
);

// ─── Plans ────────────────────────────────────────────────────────────────────

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    periodKind: varchar('period_kind', { length: 20 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    baseCurrency: char('base_currency', { length: 3 }).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('plans_household_period_idx').on(t.householdId, t.periodStart, t.periodEnd)],
);

export const plannedItems = pgTable(
  'planned_items',
  {
    id: uuid('id').primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    categoryId: uuid('category_id').notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('planned_items_plan_idx').on(t.planId),
    index('planned_items_category_idx').on(t.categoryId),
  ],
);

export const plannedItemVersions = pgTable(
  'planned_item_versions',
  {
    id: uuid('id').primaryKey(),
    plannedItemId: uuid('planned_item_id')
      .notNull()
      .references(() => plannedItems.id),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    before: jsonb('before'),
    after: jsonb('after').notNull(),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    reason: text('reason'),
  },
  (t) => [index('planned_item_versions_item_changed_idx').on(t.plannedItemId, t.changedAt)],
);

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id').references(() => households.id),
    seedKey: varchar('seed_key', { length: 100 }),
    name: varchar('name', { length: 100 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('expense'),
    icon: varchar('icon', { length: 100 }).notNull().default('tag'),
    color: varchar('color', { length: 20 }).notNull().default('#6B7280'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('categories_household_idx').on(t.householdId),
    uniqueIndex('categories_name_active_unique')
      .on(t.householdId, t.name)
      .where(sql`archived_at IS NULL`),
  ],
);

export const categoryPrivacy = pgTable('category_privacy', {
  categoryId: uuid('category_id')
    .primaryKey()
    .references(() => categories.id),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
  level: varchar('level', { length: 30 }).notNull().default('full_detail'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Currencies & FX ──────────────────────────────────────────────────────────

export const currencies = pgTable('currencies', {
  code: char('code', { length: 3 }).primaryKey(),
  exponent: integer('exponent').notNull().default(2),
  symbol: varchar('symbol', { length: 10 }).notNull(),
});

export const fxRates = pgTable(
  'fx_rates',
  {
    id: uuid('id').primaryKey(),
    base: char('base', { length: 3 }).notNull(),
    quote: char('quote', { length: 3 }).notNull(),
    rateOnDate: date('rate_on_date').notNull(),
    rate: numeric('rate', { precision: 24, scale: 10 }).notNull(),
    source: varchar('source', { length: 20 }).notNull().default('ecb'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fx_rates_date_idx').on(t.rateOnDate, t.base, t.quote),
    uniqueIndex('fx_rates_base_quote_date_unique').on(t.base, t.quote, t.rateOnDate),
  ],
);

// ─── Leftovers ────────────────────────────────────────────────────────────────

export const leftoverSnapshots = pgTable(
  'leftover_snapshots',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    planId: uuid('plan_id').references(() => plans.id),
    periodEnd: date('period_end').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('leftover_snapshots_household_period_idx').on(t.householdId, t.periodEnd),
    uniqueIndex('leftover_snapshots_unique').on(t.householdId, t.planId, t.periodEnd),
  ],
);

// ─── Notifications outbox ─────────────────────────────────────────────────────

export const notificationsOutbox = pgTable(
  'notifications_outbox',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id').references(() => households.id),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id),
    kind: varchar('kind', { length: 50 }).notNull(),
    dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [
    index('notifications_outbox_dispatch_idx').on(t.sentAt, t.createdAt),
    index('notifications_outbox_recipient_idx').on(t.recipientUserId),
    uniqueIndex('notifications_outbox_dedupe_unique').on(t.recipientUserId, t.kind, t.dedupeKey),
  ],
);

// ─── Audit log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id').references(() => households.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    subjectType: varchar('subject_type', { length: 100 }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    context: jsonb('context'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_household_at_idx').on(t.householdId, t.at),
    index('audit_log_subject_idx').on(t.subjectType, t.subjectId, t.at),
  ],
);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type SelectUser = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;
export type SelectHousehold = InferSelectModel<typeof households>;
export type SelectPlan = InferSelectModel<typeof plans>;
export type SelectPlannedItem = InferSelectModel<typeof plannedItems>;
export type SelectTransaction = InferSelectModel<typeof transactions>;
export type SelectCategory = InferSelectModel<typeof categories>;
export type SelectBankConnection = InferSelectModel<typeof bankConnections>;
export type SelectAuditLog = InferSelectModel<typeof auditLog>;
