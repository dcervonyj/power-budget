import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@formatjs/icu-messageformat-parser';
import type { Plugin } from 'vite';

const LOCALE_FILE = /[\\/]public[\\/]locales[\\/].+\.json$/;

/** Parses every ICU message into its AST. Throws on an invalid message, so a bad copy fails the build. */
export function compileMessages(
  messages: Record<string, string>,
  file: string,
): Record<string, unknown> {
  const compiled: Record<string, unknown> = {};
  for (const [id, message] of Object.entries(messages)) {
    try {
      compiled[id] = parse(message, { captureLocation: false });
    } catch (error) {
      throw new Error(`${path.basename(file)}: invalid ICU message "${id}": ${String(error)}`);
    }
  }

  return compiled;
}

/**
 * Turns the locale JSON files into ICU message ASTs at build time (CLN-074d), so
 * the runtime formats precompiled messages and the ICU parser stays out of the bundle.
 */
export function precompiledMessages(): Plugin {
  return {
    name: 'power-budget:precompiled-messages',
    // After vite:json, whose output is replaced by the AST module.
    enforce: 'post',
    transform(_code, id) {
      const file = id.split('?')[0] ?? id;
      if (!LOCALE_FILE.test(file)) {
        return null;
      }
      const messages: Record<string, string> = JSON.parse(readFileSync(file, 'utf8'));

      return {
        code: `export default ${JSON.stringify(compileMessages(messages, file))};`,
        map: null,
      };
    },
  };
}
