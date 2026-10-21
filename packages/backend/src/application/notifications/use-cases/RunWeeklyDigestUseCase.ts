import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import type { EnqueueNotificationUseCase } from './EnqueueNotificationUseCase.js';

/**
 * Households have no time-zone setting yet, so the digest week is computed in
 * the product's home zone. The worker cron fires on Monday 08:00 in this zone.
 */
export const DEFAULT_DIGEST_TIME_ZONE = 'Europe/Warsaw';

export class RunWeeklyDigestUseCase {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly enqueueNotification: EnqueueNotificationUseCase,
  ) {}

  async execute(
    now: Date = new Date(),
    timeZone: string = DEFAULT_DIGEST_TIME_ZONE,
  ): Promise<void> {
    const members = await this.notificationRepo.listAllHouseholdMembers();
    const periodLabel = this.getIsoWeekLabel(now, timeZone);

    for (const member of members) {
      if (member.emailBouncing) continue;

      await this.enqueueNotification.execute({
        recipientUserId: member.userId,
        householdId: member.householdId,
        kind: 'weekly_digest',
        dedupeKey: `${member.householdId}:${member.userId}:${periodLabel}`,
        payload: {
          name: member.displayName,
          planName: '',
          totalSpent: '',
          totalPlanned: '',
          currency: '',
          periodStart: periodLabel,
          periodEnd: periodLabel,
        },
      });
    }
  }

  /** ISO-8601 week label (e.g. `2026-W53`, `2027-W01`) of the local calendar date in `timeZone`. */
  private getIsoWeekLabel(instant: Date, timeZone: string): string {
    const d = this.toLocalMidnightUtc(instant, timeZone);
    const dayNum = d.getUTCDay() || 7;
    // The ISO week belongs to the year of its Thursday.
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const isoYear = d.getUTCFullYear();
    const yearStart = Date.UTC(isoYear, 0, 1);
    const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);

    return `${isoYear}-W${String(week).padStart(2, '0')}`;
  }

  /** The local calendar date of `instant` in `timeZone`, as a UTC-midnight Date. */
  private toLocalMidnightUtc(instant: Date, timeZone: string): Date {
    // en-CA formats as YYYY-MM-DD.
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);

    return new Date(`${localDate}T00:00:00Z`);
  }
}
