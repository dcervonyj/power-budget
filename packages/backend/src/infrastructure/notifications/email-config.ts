export const DEFAULT_EMAIL_FROM = 'Power Budget <noreply@powerbudget.app>';

/** Deployed environments, where a worker without an email key would drop every notification. */
const ENVIRONMENTS_THAT_SEND_EMAIL: readonly string[] = ['production', 'staging'];

export interface EmailEnv {
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_FROM?: string;
  readonly NODE_ENV?: string;
}

export interface EmailConfig {
  readonly resendApiKey: string;
  readonly from: string;
}

export class MissingEmailConfigError extends Error {
  constructor(nodeEnv: string) {
    super(
      `RESEND_API_KEY is required when NODE_ENV=${nodeEnv}: the worker cannot send notification email without it.`,
    );
    this.name = 'MissingEmailConfigError';
  }
}

/** Worker boot check: refuses to start a deployed worker that cannot send email. */
export function resolveEmailConfig(env: EmailEnv): EmailConfig {
  const resendApiKey = (env.RESEND_API_KEY ?? '').trim();
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (resendApiKey === '' && ENVIRONMENTS_THAT_SEND_EMAIL.includes(nodeEnv)) {
    throw new MissingEmailConfigError(nodeEnv);
  }
  const from = (env.EMAIL_FROM ?? '').trim();

  return { resendApiKey, from: from === '' ? DEFAULT_EMAIL_FROM : from };
}
