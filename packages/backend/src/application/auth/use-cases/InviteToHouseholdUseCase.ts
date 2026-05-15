import { createHash, randomBytes } from 'node:crypto';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  AppConfigPort,
} from '../../../domain/auth/ports.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface InviteToHouseholdInput {
  readonly inviterUserId: UserId;
  readonly inviteeEmail: string;
  readonly householdId: HouseholdId;
}

export interface InviteToHouseholdOutput {
  readonly inviteUrl: string;
}

export class InviteToHouseholdUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly userRepo: UserRepository,
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly config: AppConfigPort,
  ) {}

  async execute(input: InviteToHouseholdInput): Promise<InviteToHouseholdOutput> {
    await this.assertInviterIsOwner(input.inviterUserId, input.householdId);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await this.inviteRepo.create({
      id: randomBytes(16).toString('hex'),
      householdId: input.householdId,
      email: input.inviteeEmail,
      tokenHash,
      expiresAt,
      acceptedAt: null,
    });

    const baseUrl = this.config.get('APP_BASE_URL');
    const inviteUrl = `${baseUrl}/invite/accept?token=${token}`;

    return { inviteUrl };
  }

  private async assertInviterIsOwner(userId: UserId, householdId: HouseholdId): Promise<void> {
    const membership = await this.householdRepo.findMembership(householdId, userId);
    if (membership === null || membership.role !== 'owner') {
      throw new UserNotFoundError();
    }
  }
}
