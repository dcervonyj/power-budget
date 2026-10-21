/** The least-privilege role the integration suite runs the app as (created by drizzle/roles.mjs). */
export const APP_ROLE = { user: 'pb_app_it', password: 'pb-app-it-password' } as const;

export function appRoleUrl(superuserUrl: string): string {
  const url = new URL(superuserUrl);
  url.username = APP_ROLE.user;
  url.password = APP_ROLE.password;

  return url.toString();
}
