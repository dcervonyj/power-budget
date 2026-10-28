import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  SECRET_PAYLOAD_KEYS,
  type NotificationOutboxRow,
} from '../../domain/notifications/entities.js';
import type { ClaimedRecipient, NotificationClaim } from '../../domain/notifications/ports.js';
import * as schema from '../../../drizzle/schema.js';

/**
 * A claimed outbox row; each mark is its own short statement on the pool.
 * Overlapping attempts are reconciled by what actually happened: a delivered
 * email is a fact, so markSent applies unless the row is already sent and also
 * clears a failed mark an overlapping attempt wrote. markFailed only applies to
 * the latest attempt (attempts still equals this claim's count) of a still
 * pending row, so an earlier attempt can never fail a row a later one owns.
 */
export class DrizzleNotificationClaim implements NotificationClaim {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    readonly notification: NotificationOutboxRow,
    readonly recipient: ClaimedRecipient | null,
  ) {}

  async markSent(): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ sentAt: new Date(), failedAt: null, payload: this.payloadWithoutSecrets() })
      .where(
        and(
          eq(schema.notificationsOutbox.id, this.notification.id),
          isNull(schema.notificationsOutbox.sentAt),
        ),
      );
  }

  async markFailed(): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ failedAt: new Date(), payload: this.payloadWithoutSecrets() })
      .where(this.stillPending());
  }

  private stillPending(): SQL | undefined {
    return and(
      eq(schema.notificationsOutbox.id, this.notification.id),
      isNull(schema.notificationsOutbox.sentAt),
      isNull(schema.notificationsOutbox.failedAt),
      eq(schema.notificationsOutbox.attempts, this.notification.attempts),
    );
  }

  /** `payload - ARRAY['link', 'token']`: jsonb minus every secret key. */
  private payloadWithoutSecrets(): SQL {
    const keys = sql.join(
      SECRET_PAYLOAD_KEYS.map((key) => sql`${key}`),
      sql`, `,
    );

    return sql`${schema.notificationsOutbox.payload} - ARRAY[${keys}]::text[]`;
  }
}
