import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_DIRECTORY = resolve(process.cwd(), 'src');
const LOCALES_DIRECTORY = resolve(process.cwd(), 'assets/locales');
const MESSAGE_ID_PATTERN =
  /\bid\s*(?:=\s*\{?\s*|:\s*)["']([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+)["']/g;
const TEST_FILE_PATTERN = /(?:\.(?:spec|test)\.tsx?$)|(?:\.d\.ts$)/;

// Ids with an inline defaultMessage render through the fallback, so only ids that
// rely on the bundle alone must exist there.
function hasDefaultMessage(source: string, index: number): boolean {
  return source.slice(Math.max(0, index - 150), index + 300).includes('defaultMessage');
}

function readMessageIds(directory: string): Set<string> {
  const messageIds = new Set<string>();

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      for (const messageId of readMessageIds(path)) {
        messageIds.add(messageId);
      }
    } else if (
      entry.isFile() &&
      /\.tsx?$/.test(entry.name) &&
      !TEST_FILE_PATTERN.test(entry.name)
    ) {
      const source = readFileSync(path, 'utf8');

      for (const match of source.matchAll(MESSAGE_ID_PATTERN)) {
        const [, messageId] = match;

        if (messageId !== undefined && !hasDefaultMessage(source, match.index)) {
          messageIds.add(messageId);
        }
      }
    }
  }

  return messageIds;
}

function readEnglishMessageIds(): Set<string> {
  const messageIds = new Set<string>();
  const legacyMessages: Record<string, string> = JSON.parse(
    readFileSync(resolve(LOCALES_DIRECTORY, 'en.json'), 'utf8'),
  );

  for (const messageId of Object.keys(legacyMessages)) {
    messageIds.add(messageId);
  }

  for (const fileName of readdirSync(resolve(LOCALES_DIRECTORY, 'en'))) {
    const featureMessages: Record<string, string> = JSON.parse(
      readFileSync(resolve(LOCALES_DIRECTORY, 'en', fileName), 'utf8'),
    );

    for (const messageId of Object.keys(featureMessages)) {
      messageIds.add(messageId);
    }
  }

  return messageIds;
}

describe('English message coverage', () => {
  it('contains every literal message id referenced in source', () => {
    const englishMessageIds = readEnglishMessageIds();
    const missingMessageIds = [...readMessageIds(SOURCE_DIRECTORY)].filter(
      (messageId) => !englishMessageIds.has(messageId),
    );

    expect(missingMessageIds).toEqual([]);
  });
});
