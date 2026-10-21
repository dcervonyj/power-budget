import { eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  SECRET_PAYLOAD_KEYS,
  type NotificationOutbox,
} from '../../domain/notifications/entities.js';
import type { NotificationClaim } from '../../domain/notifications/ports.js';
import * as schema from '../../../drizzle/schema.js';

type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

/** A claimed outbox row; writes go through the transaction that holds the row lock. */
export class DrizzleNotificationClaim implements NotificationClaim {
  constructor(
    private readonly tx: Transaction,
    readonly notification: NotificationOutbox,
  ) {}

  async markSent(): Promise<void> {
    await this.tx
      .update(schema.notificationsOutbox)
      .set({ sentAt: new Date(), payload: this.payloadWithoutSecrets() })
      .where(eq(schema.notificationsOutbox.id, this.notification.id));
  }

  async markFailed(): Promise<void> {
    await this.tx
      .update(schema.notificationsOutbox)
      .set({ failedAt: new Date(), payload: this.payloadWithoutSecrets() })
      .where(eq(schema.notificationsOutbox.id, this.notification.id));
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
