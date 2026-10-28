/** The part of an email before the `@`; the whole email when there is no `@` or the part is empty. */
export function emailLocalPart(email: string): string {
  const at = email.indexOf('@');

  return at <= 0 ? email : email.slice(0, at);
}
