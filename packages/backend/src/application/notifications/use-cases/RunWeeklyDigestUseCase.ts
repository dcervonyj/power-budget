import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import type { EnqueueNotificationUseCase } from './EnqueueNotificationUseCase.js';

export class RunWeeklyDigestUseCase {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly enqueueNotification: EnqueueNotificationUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<void> {
    const members = await this.notificationRepo.listAllHouseholdMembers();
    const periodLabel = this.getPeriodLabel(now);

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

  private getPeriodLabel(date: Date): string {
    const year = date.getFullYear();
    const week = this.getIsoWeek(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private getIsoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
