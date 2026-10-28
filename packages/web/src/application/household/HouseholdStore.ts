import { makeAutoObservable } from 'mobx';
import { readApiError, type HouseholdsApi, type PlansApi } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type HouseholdDashboardCategoryDto,
  type HouseholdInviteResponseDto,
  type HouseholdMemberResponseDto,
  type PlanDto,
} from '@power-budget/shared-app/contract';

/** A household has at most two members in the MVP: you and your partner (CLN-006). */
export const HOUSEHOLD_MAX_MEMBERS = 2;

export type HouseholdInviteError =
  'household_full' | 'invite_self' | 'too_many_requests' | 'invalid_email' | 'failed';

export type HouseholdAggregatesError = 'fx_unavailable' | 'failed';

/** The last invite action that went through, for a short confirmation. */
export type HouseholdInviteNotice = 'sent' | 'resent' | 'revoked';

export type HouseholdMembersApi = Pick<
  HouseholdsApi,
  'members' | 'invites' | 'invite' | 'resendInvite' | 'revokeInvite' | 'dashboard'
>;
export type HouseholdPlansApi = Pick<PlansApi, 'list'>;

/**
 * The household screen: who is in the household, the owner's open invite (send,
 * resend, revoke) and, per household plan, both members' per-category totals as
 * the API reduces them to each category's privacy level.
 */
export class HouseholdStore {
  userId = '';
  householdId = '';
  members: HouseholdMemberResponseDto[] = [];
  invites: HouseholdInviteResponseDto[] = [];
  householdPlans: PlanDto[] = [];
  selectedPlanId: string | null = null;
  categories: HouseholdDashboardCategoryDto[] = [];

  loading = false;
  loaded = false;
  loadFailed = false;
  aggregatesLoading = false;
  aggregatesError: HouseholdAggregatesError | null = null;
  inviteBusy = false;
  inviteError: HouseholdInviteError | null = null;
  inviteNotice: HouseholdInviteNotice | null = null;

  private readonly households: HouseholdMembersApi;
  private readonly plans: HouseholdPlansApi;
  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;

  constructor(households: HouseholdMembersApi, plans: HouseholdPlansApi) {
    this.households = households;
    this.plans = plans;
    makeAutoObservable<HouseholdStore, 'households' | 'plans' | 'session'>(this, {
      households: false,
      plans: false,
      session: false,
    });
  }

  get isOwner(): boolean {
    return this.members.some(this.isOwnMembershipAsOwner, this);
  }

  get partner(): HouseholdMemberResponseDto | undefined {
    return this.members.find(this.isSomeoneElse, this);
  }

  /** The owner may invite while the household has room and no partner yet. */
  get canInvite(): boolean {
    return this.isOwner && this.members.length < HOUSEHOLD_MAX_MEMBERS;
  }

  async load(userId: string, householdId: string): Promise<void> {
    if (userId !== this.userId || householdId !== this.householdId) {
      this.reset();
    }
    const session = this.session;
    this.userId = userId;
    this.householdId = householdId;
    this.loading = true;
    this.loadFailed = false;
    try {
      const [members, plans] = await Promise.all([this.households.members(), this.plans.list()]);
      if (!this.applyMembers(session, members, plans)) {
        return;
      }
      if (this.isOwner) {
        this.applyInvites(session, await this.households.invites());
      }
      await this.loadAggregates();
    } catch {
      this.applyLoadFailed(session);
    }
  }

  async selectPlan(planId: string): Promise<void> {
    this.selectedPlanId = planId;
    await this.loadAggregates();
  }

  async sendInvite(email: string): Promise<void> {
    const address = email.trim();
    if (!isEmailLike(address)) {
      this.inviteError = 'invalid_email';
      this.inviteNotice = null;

      return;
    }
    await this.runInviteAction(this.households.invite(address), 'sent');
  }

  async resendInvite(inviteId: string): Promise<void> {
    await this.runInviteAction(this.households.resendInvite(inviteId), 'resent');
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.runInviteAction(this.households.revokeInvite(inviteId), 'revoked');
  }

  /** Sign-out or session end: nothing of the previous user's household stays. */
  resetSession(): void {
    this.session += 1;
    this.reset();
    this.userId = '';
    this.householdId = '';
    this.loading = false;
    this.loadFailed = false;
    this.aggregatesLoading = false;
    this.aggregatesError = null;
    this.inviteBusy = false;
  }

  private async loadAggregates(): Promise<void> {
    const session = this.session;
    const planId = this.selectedPlanId;
    if (planId === null || this.householdId === '') {
      this.categories = [];

      return;
    }
    this.aggregatesLoading = true;
    this.aggregatesError = null;
    try {
      const dashboard = await this.households.dashboard(this.householdId, planId);
      this.applyAggregates(session, planId, dashboard.categories);
    } catch (err) {
      this.applyAggregatesFailed(
        session,
        planId,
        readApiError(err).code === FX_RATE_UNAVAILABLE ? 'fx_unavailable' : 'failed',
      );
    }
  }

  /** Every invite action ends with the open invite re-read from the API. */
  private async runInviteAction(
    action: Promise<unknown>,
    notice: HouseholdInviteNotice,
  ): Promise<void> {
    const session = this.session;
    this.inviteBusy = true;
    this.inviteError = null;
    this.inviteNotice = null;
    try {
      await action;
      this.applyInviteDone(session, notice, await this.households.invites());
    } catch (err) {
      this.applyInviteFailed(session, classifyInviteError(err));
    }
  }

  /** Another user or household (sign-out, accepted invite): nothing of the old one stays. */
  private reset(): void {
    this.members = [];
    this.invites = [];
    this.householdPlans = [];
    this.selectedPlanId = null;
    this.categories = [];
    this.loaded = false;
    this.inviteError = null;
    this.inviteNotice = null;
  }

  /** False when the answer belongs to a session that has ended. */
  private applyMembers(
    session: number,
    members: HouseholdMemberResponseDto[],
    plans: PlanDto[],
  ): boolean {
    if (session !== this.session) {
      return false;
    }
    this.members = members;
    this.householdPlans = plans.filter(isHouseholdPlan);
    const kept = this.householdPlans.some(this.isSelectedPlan, this);
    const first = this.householdPlans[0];
    this.selectedPlanId = kept ? this.selectedPlanId : first === undefined ? null : first.id;
    this.loaded = true;
    this.loading = false;

    return true;
  }

  private applyInvites(session: number, invites: HouseholdInviteResponseDto[]): void {
    if (session === this.session) {
      this.invites = invites;
    }
  }

  private applyLoadFailed(session: number): void {
    if (session !== this.session) {
      return;
    }
    this.loadFailed = true;
    this.loading = false;
  }

  private applyAggregates(
    session: number,
    planId: string,
    categories: HouseholdDashboardCategoryDto[],
  ): void {
    if (session !== this.session || this.selectedPlanId !== planId) {
      return;
    }
    this.categories = categories;
    this.aggregatesLoading = false;
  }

  private applyAggregatesFailed(
    session: number,
    planId: string,
    error: HouseholdAggregatesError,
  ): void {
    if (session !== this.session || this.selectedPlanId !== planId) {
      return;
    }
    this.categories = [];
    this.aggregatesError = error;
    this.aggregatesLoading = false;
  }

  private applyInviteDone(
    session: number,
    notice: HouseholdInviteNotice,
    invites: HouseholdInviteResponseDto[],
  ): void {
    if (session !== this.session) {
      return;
    }
    this.invites = invites;
    this.inviteNotice = notice;
    this.inviteBusy = false;
  }

  private applyInviteFailed(session: number, error: HouseholdInviteError): void {
    if (session !== this.session) {
      return;
    }
    this.inviteError = error;
    this.inviteBusy = false;
  }

  private isOwnMembershipAsOwner(member: HouseholdMemberResponseDto): boolean {
    return member.userId === this.userId && member.role === 'owner';
  }

  private isSomeoneElse(member: HouseholdMemberResponseDto): boolean {
    return member.userId !== this.userId;
  }

  private isSelectedPlan(plan: PlanDto): boolean {
    return plan.id === this.selectedPlanId;
  }
}

function isHouseholdPlan(plan: PlanDto): boolean {
  return plan.type === 'household';
}

/** The API validates the address; this only catches an empty or obviously wrong field. */
function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function classifyInviteError(err: unknown): HouseholdInviteError {
  const { status, code } = readApiError(err);
  switch (code) {
    case 'household_full':
      return 'household_full';
    case 'invite_self':
      return 'invite_self';
    case 'too_many_requests':
      return 'too_many_requests';
    default:
      return status === 400 ? 'invalid_email' : 'failed';
  }
}
