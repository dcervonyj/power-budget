import { SetMetadata } from '@nestjs/common';

export const REQUIRE_RECENT_TOTP_KEY = 'require_recent_totp_minutes';

/** Marks a controller method as requiring TOTP re-verification within N minutes. */
export const RequireRecentTotp = (minutes = 5): MethodDecorator =>
  SetMetadata(REQUIRE_RECENT_TOTP_KEY, minutes);
