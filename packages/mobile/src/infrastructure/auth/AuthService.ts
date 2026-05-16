import type { ApiClient } from '@power-budget/shared-app';
import type { SecureTokenStore } from '@power-budget/shared-app/infrastructure';

export interface LoginParams {
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
}

export interface RegisterParams {
  readonly email: string;
  readonly password: string;
  readonly locale: string;
}

export interface LoginResult {
  readonly requiresTotp: boolean;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
}

interface TotpEnableResponseData {
  qrCodeUri: string;
  recoveryCodes: string[];
}

export class AuthService {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly tokenStore: SecureTokenStore,
  ) {}

  async login(params: LoginParams): Promise<LoginResult> {
    try {
      const response = await this.apiClient.post<LoginResponseData>('/auth/login', {
        email: params.email,
        password: params.password,
        ...(params.totpCode !== undefined ? { totpCode: params.totpCode } : {}),
      });

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
    await this.apiClient.post('/auth/register', {
      email: params.email,
      password: params.password,
      locale: params.locale,
    });
  }

  async requestMagicLink(email: string): Promise<void> {
    await this.apiClient.post('/auth/magic-link/request', { email });
  }

  async enableTotp(): Promise<{ qrCodeUri: string; recoveryCodes: string[] }> {
    const response = await this.apiClient.post<TotpEnableResponseData>('/auth/totp/enable', {});
    return response.data;
  }

  async verifyTotp(code: string): Promise<void> {
    await this.apiClient.post('/auth/totp/verify', { code });
  }

  async handleOAuthCallback(code: string, state: string | undefined): Promise<void> {
    const response = await this.apiClient.post<LoginResponseData>('/auth/oauth/google/callback', {
      code,
      ...(state !== undefined ? { state } : {}),
    });
    await this.tokenStore.setTokens(response.data.accessToken, response.data.refreshToken);
  }
}
