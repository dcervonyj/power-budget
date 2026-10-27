import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  SECRET_PAYLOAD_KEYS,
  type NotificationOutbox,
} from '../../domain/notifications/entities.js';
import type { ClaimedRecipient, NotificationClaim } from '../../domain/notifications/ports.js';
import * as schema from '../../../drizzle/schema.js';

/**
 * A claimed outbox row; each mark is its own short statement on the pool. A mark
 * only applies while the row is still pending, so overlapping attempts cannot
 * flip a terminal row (sent and failed are mutually exclusive, first one wins).
 */
export class DrizzleNotificationClaim implements NotificationClaim {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    readonly notification: NotificationOutbox,
    readonly recipient: ClaimedRecipient | null,
  ) {}

  async markSent(): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ sentAt: new Date(), payload: this.payloadWithoutSecrets() })
      .where(this.stillPending());
  }

  async markFailed(): Promise<void> {
    await this.db
      .update(schema.notificationsOutbox)
      .set({ failedAt: new Date(), payload: this.payloadWithoutSecrets() })
      .where(this.stillPending());
  }

  /** `payload - ARRAY['link', 'token']`: jsonb minus every secret key. */
  private stillPending(): SQL | undefined {
    return and(
      eq(schema.notificationsOutbox.id, this.notification.id),
      isNull(schema.notificationsOutbox.sentAt),
      isNull(schema.notificationsOutbox.failedAt),
    );
  }

  private payloadWithoutSecrets(): SQL {
    const keys = sql.join(
      SECRET_PAYLOAD_KEYS.map((key) => sql`${key}`),
      sql`, `,
    );

    return sql`${schema.notificationsOutbox.payload} - ARRAY[${keys}]::text[]`;
  }
}
