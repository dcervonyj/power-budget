/** The part of an email before the `@`; the whole string when there is no `@`. */
export function emailLocalPart(email: string): string {
  const at = email.indexOf('@');

  return at === -1 ? email : email.slice(0, at);
}
