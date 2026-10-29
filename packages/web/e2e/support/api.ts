import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import type { components } from '@power-budget/shared-app/contract';
import { STACK } from './stack.js';

type Schemas = components['schemas'];
export type AuthTokens = Schemas['AuthTokensDto'];
export type PlanDto = Schemas['PlanDto'];
export type PlannedItemDto = Schemas['PlannedItemDto'];
export type CategoryDto = Schemas['CategoryDto'];

export const PASSWORD = 'E2e-Str0ng-Pass!';

/** A fresh address per call, so reruns and retries never collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

/** Talks to the real backend over HTTP, the way the web app does. Seeds fixtures through public endpoints only. */
export class BackendApi {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Registers a user. A new user is sent to onboarding after sign-in (CLN-073), so by default the
   * fixture marks onboarding completed and the journey under test starts on the dashboard;
   * pass `{ onboarded: false }` to test the onboarding entry itself.
   */
  async register(
    email: string,
    options: { onboarded: boolean } = { onboarded: true },
  ): Promise<AuthTokens> {
    const res = await this.request.post(`${STACK.apiUrl}/auth/register`, {
      data: { email, password: PASSWORD },
      headers: this.clientIpHeader(),
    });
    const tokens = await this.json<AuthTokens>(res, 201);
    if (options.onboarded) {
      const patched = await this.request.patch(`${STACK.apiUrl}/users/me`, {
        headers: this.auth(tokens.accessToken),
        data: { onboardingCompleted: true },
      });
      expect(patched.status()).toBe(200);
    }

    return tokens;
  }

  async login(email: string): Promise<AuthTokens> {
    const res = await this.request.post(`${STACK.apiUrl}/auth/login`, {
      data: { email, password: PASSWORD },
      headers: this.clientIpHeader(),
    });

    return this.json<AuthTokens>(res, 201);
  }

  /**
   * The auth endpoints allow 20 calls per minute per client IP. Fixture calls come
   * from one machine, so each one claims its own address (the e2e backend runs with
   * TRUST_PROXY=true); the browser's own logins keep the real socket address.
   */
  clientIpHeader(): Record<string, string> {
    const address = [10, this.randomOctet(), this.randomOctet(), this.randomOctet()].join('.');

    return { 'x-forwarded-for': address };
  }

  async get(path: string, accessToken: string): Promise<APIResponse> {
    return this.request.get(`${STACK.apiUrl}${path}`, { headers: this.auth(accessToken) });
  }

  async post(path: string, accessToken: string, data: object): Promise<APIResponse> {
    return this.request.post(`${STACK.apiUrl}${path}`, { headers: this.auth(accessToken), data });
  }

  async expenseCategory(accessToken: string): Promise<CategoryDto> {
    const categories = await this.json<CategoryDto[]>(
      await this.get('/categories', accessToken),
      200,
    );
    const expense = categories.find(
      (category) => category.kind === 'expense' && !category.archived,
    );
    if (expense === undefined) {
      throw new Error('GET /categories returned no expense category');
    }

    return expense;
  }

  async createPlan(
    accessToken: string,
    plan: Pick<PlanDto, 'name' | 'type' | 'baseCurrency'>,
  ): Promise<PlanDto> {
    const res = await this.post('/plans', accessToken, {
      ...plan,
      periodKind: 'monthly',
      periodStart: currentMonthStart(),
    });

    return this.json<PlanDto>(res, 201);
  }

  async addExpenseItem(
    accessToken: string,
    planId: string,
    categoryId: string,
    amountMinor: string,
    currency: string,
  ): Promise<PlannedItemDto> {
    const res = await this.post(`/plans/${planId}/items`, accessToken, {
      categoryId,
      direction: 'expense',
      amountMinor,
      currency,
    });

    return this.json<PlannedItemDto>(res, 201);
  }

  async invite(accessToken: string, email: string): Promise<void> {
    await this.json(await this.post('/households/invites', accessToken, { email }), 201);
  }

  /** The token from the invite link in the email the worker delivered to the fake Resend API. */
  async inviteToken(email: string): Promise<string> {
    let token: string | null = null;
    await expect
      .poll(
        async () => {
          token = await this.findInviteToken(email);

          return token;
        },
        { message: `invite email to ${email}`, timeout: 30_000 },
      )
      .not.toBeNull();
    if (token === null) {
      throw new Error(`No invite email to ${email}`);
    }

    return token;
  }

  async acceptInvite(
    accessToken: string,
    token: string,
  ): Promise<Schemas['AcceptInviteResponseDto']> {
    const res = await this.post('/households/invites/accept', accessToken, { token });

    return this.json<Schemas['AcceptInviteResponseDto']>(res, 200);
  }

  async json<T>(res: APIResponse, status: number): Promise<T> {
    if (res.status() !== status) {
      throw new Error(
        `${res.url()} answered ${String(res.status())}, expected ${String(status)}: ${await res.text()}`,
      );
    }

    const body: T = await res.json();

    return body;
  }

  private async findInviteToken(email: string): Promise<string | null> {
    const res = await this.request.get(
      `${STACK.fakeResendUrl}/__e2e/emails?to=${encodeURIComponent(email)}`,
    );
    const emails: Array<{ html: string }> = await res.json();
    for (const message of emails.reverse()) {
      const match = /invite\/accept\?token=([0-9a-f]{64})/.exec(message.html);
      if (match?.[1] !== undefined) {
        return match[1];
      }
    }

    return null;
  }

  private randomOctet(): number {
    return Math.floor(Math.random() * 254) + 1;
  }

  private auth(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }
}

export interface HouseholdMember {
  readonly email: string;
  readonly tokens: AuthTokens;
}

export interface TwoUserHousehold {
  readonly householdId: string;
  readonly owner: HouseholdMember;
  readonly partner: HouseholdMember;
}

/**
 * The seeded 2-user household: the owner registers (and gets a household), invites
 * the partner, the worker emails the invite, the partner registers and accepts.
 * Everything goes through the public API and the real email dispatch.
 */
export async function seedTwoUserHousehold(api: BackendApi): Promise<TwoUserHousehold> {
  const ownerEmail = uniqueEmail('owner');
  const partnerEmail = uniqueEmail('partner');
  const owner = await api.register(ownerEmail);
  await api.invite(owner.accessToken, partnerEmail);
  const token = await api.inviteToken(partnerEmail);
  const partner = await api.register(partnerEmail);
  const joined = await api.acceptInvite(partner.accessToken, token);

  return {
    householdId: joined.householdId,
    owner: { email: ownerEmail, tokens: owner },
    partner: {
      email: partnerEmail,
      tokens: { ...partner, accessToken: joined.accessToken },
    },
  };
}

/** Opens the app already signed in (the keys LocalStorageTokenStore uses). */
export async function signInWithTokens(page: Page, tokens: AuthTokens): Promise<void> {
  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      if (localStorage.getItem('pb_access_token') === null) {
        localStorage.setItem('pb_access_token', accessToken);
        localStorage.setItem('pb_refresh_token', refreshToken);
      }
    },
    { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  );
}

export function currentMonthStart(): string {
  const now = new Date();

  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
