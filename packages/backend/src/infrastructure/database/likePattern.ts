/**
 * Builds an ILIKE/LIKE pattern that matches `text` literally anywhere in the value.
 * `%`, `_` and the escape character `\` in user input are escaped, so a search for
 * "50%" does not match "500" and "_" does not match every character (audit L4).
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
