import type { ApiClient } from '@power-budget/shared-app';
import type { SecureTokenStore } from '@power-budget/shared-app/infrastructure';
import type {
  AuthTokensDto,
  LocaleCode,
  LoginDto,
  RegisterDto,
  RequestMagicLinkDto,
  TotpEnrollmentDto,
  VerifyTotpDto,
} from '@power-budget/shared-app/contract';

export interface LoginParams {
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
}

export interface RegisterParams {
  readonly email: string;
  readonly password: string;
  readonly locale: LocaleCode;
}

export interface LoginResult {
  readonly requiresTotp: boolean;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

export class AuthService {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly tokenStore: SecureTokenStore,
  ) {}

  async login(params: LoginParams): Promise<LoginResult> {
    try {
      const body: LoginDto =
        params.totpCode !== undefined
          ? { email: params.email, password: params.password, totp: params.totpCode }
          : { email: params.email, password: params.password };
      const response = await this.apiClient.post<AuthTokensDto>('/auth/login', body);

      await this.tokenStore.setTokens(response.data.accessToken, response.data.refreshToken);

      return {
        requiresTotp: false,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { code?: string } } };
      if (err.response?.data?.code === 'requires_totp') {
        return { requiresTotp: true };
      }
      throw error;
    }
  }

  async register(params: RegisterParams): Promise<void> {
    const body: RegisterDto = {
      email: params.email,
      password: params.password,
      locale: params.locale,
    };
    await this.apiClient.post('/auth/register', body);
  }

  async requestMagicLink(email: string): Promise<void> {
    const body: RequestMagicLinkDto = { email };
    await this.apiClient.post('/auth/magic-link/request', body);
  }

  /** TotpEnrollmentDto `{ qrCodeUri, secret }`: the API issues no recovery codes. */
  async enableTotp(): Promise<TotpEnrollmentDto> {
    const response = await this.apiClient.post<TotpEnrollmentDto>('/auth/totp/enable', {});

    return response.data;
  }

  async verifyTotp(code: string): Promise<void> {
    const body: VerifyTotpDto = { code };
    await this.apiClient.post('/auth/totp/verify', body);
  }

  /** The API has no OAuth endpoint (web dropped Google sign-in in CLN-014); CLN-015 decides. */
  async handleOAuthCallback(code: string, state: string | undefined): Promise<void> {
    const response = await this.apiClient.post<AuthTokensDto>('/auth/oauth/google/callback', {
      code,
      ...(state !== undefined ? { state } : {}),
    });
    await this.tokenStore.setTokens(response.data.accessToken, response.data.refreshToken);
  }
}
