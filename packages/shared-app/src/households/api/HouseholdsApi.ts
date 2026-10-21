import type { HttpClient } from '../../infrastructure/api-client/HttpClient.js';
import type {
  AcceptInviteDto,
  AcceptInviteResponseDto,
  HouseholdDashboardResponseDto,
  HouseholdInviteResponseDto,
  HouseholdMemberResponseDto,
  InviteToHouseholdDto,
} from '../../contract/dto.js';

/**
 * The household endpoints (CLN-006 invites, CLN-012 dashboard, UI-013 members),
 * typed with the generated API contract. The household is always the caller's own,
 * taken from the access token, except for the dashboard, which names it in the path.
 */
export class HouseholdsApi {
  constructor(private readonly http: HttpClient) {}

  async members(): Promise<HouseholdMemberResponseDto[]> {
    const res = await this.http.get<HouseholdMemberResponseDto[]>('/households/members');

    return res.data;
  }

  /** The open invite (pending or expired); owner only, a member gets 403. */
  async invites(): Promise<HouseholdInviteResponseDto[]> {
    const res = await this.http.get<HouseholdInviteResponseDto[]>('/households/invites');

    return res.data;
  }

  async invite(email: string): Promise<HouseholdInviteResponseDto> {
    const body: InviteToHouseholdDto = { email };
    const res = await this.http.post<HouseholdInviteResponseDto>('/households/invites', body);

    return res.data;
  }

  /** A new link and a new 7-day expiry; the old link stops working. */
  async resendInvite(inviteId: string): Promise<HouseholdInviteResponseDto> {
    const res = await this.http.post<HouseholdInviteResponseDto>(
      `/households/invites/${inviteId}/resend`,
      {},
    );

    return res.data;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.http.delete(`/households/invites/${inviteId}`);
  }

  /** The token travels in the body, never in the URL. */
  async acceptInvite(token: string): Promise<AcceptInviteResponseDto> {
    const body: AcceptInviteDto = { token };
    const res = await this.http.post<AcceptInviteResponseDto>('/households/invites/accept', body);

    return res.data;
  }

  /** Per-category totals of both members, reduced to what each category's privacy allows. */
  async dashboard(householdId: string, planId: string): Promise<HouseholdDashboardResponseDto> {
    const res = await this.http.get<HouseholdDashboardResponseDto>(
      `/households/${householdId}/dashboard?planId=${encodeURIComponent(planId)}`,
    );

    return res.data;
  }
}
