import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function readFeatureMessageIds(featureDirectory) {
  const messageIds = new Set();

  for (const fileName of readdirSync(featureDirectory)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const messages = JSON.parse(readFileSync(join(featureDirectory, fileName), 'utf8'));

    for (const messageId of Object.keys(messages)) {
      messageIds.add(messageId);
    }
  }

  return messageIds;
}

export function excludeFeatureMessages(extractedMessages, featureMessageIds) {
  return Object.fromEntries(
    Object.entries(extractedMessages).filter(([messageId]) => !featureMessageIds.has(messageId)),
  );
}

function writeLegacyMessages(extractedMessagesPath, featureDirectory, legacyMessagesPath) {
  const extractedMessages = JSON.parse(readFileSync(extractedMessagesPath, 'utf8'));
  const extractedLegacyMessages = excludeFeatureMessages(
    extractedMessages,
    readFeatureMessageIds(featureDirectory),
  );
  const existingLegacyMessages = JSON.parse(readFileSync(legacyMessagesPath, 'utf8'));
  const legacyMessages = { ...existingLegacyMessages, ...extractedLegacyMessages };

  writeFileSync(legacyMessagesPath, `${JSON.stringify(legacyMessages, null, 2)}\n`);
}

const [extractedMessagesPath, featureDirectory, legacyMessagesPath] = process.argv.slice(2);

if (extractedMessagesPath && featureDirectory && legacyMessagesPath) {
  writeLegacyMessages(extractedMessagesPath, featureDirectory, legacyMessagesPath);
}
