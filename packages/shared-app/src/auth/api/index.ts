import type { components } from '../../contract/api-types.js';

export type RegisterBody = components['schemas']['RegisterDto'];

export type LoginBody = components['schemas']['LoginDto'];

export type RequestMagicLinkBody = components['schemas']['RequestMagicLinkDto'];

export type ConsumeMagicLinkBody = components['schemas']['ConsumeMagicLinkDto'];

export type VerifyTotpBody = components['schemas']['VerifyTotpDto'];

export type RefreshTokenBody = components['schemas']['RefreshTokenDto'];

export type LogoutBody = components['schemas']['LogoutDto'];

export class AuthApiAdapter {
  // Typed stubs — full implementations added in subsequent tasks
}
