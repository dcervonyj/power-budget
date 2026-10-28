import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TRANSLATED_LOCALES = ['pl', 'uk', 'ru'];

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

// Keeps the order of the existing English messages (refreshing their text from the
// source) and appends every extracted id the bundle does not have yet, sorted by id.
export function mergeLegacyMessages(existingLegacyMessages, extractedLegacyMessages) {
  const refreshed = Object.entries(existingLegacyMessages).map(([messageId, message]) => [
    messageId,
    extractedLegacyMessages[messageId] ?? message,
  ]);
  const added = Object.entries(extractedLegacyMessages)
    .filter(([messageId]) => !(messageId in existingLegacyMessages))
    .sort(([left], [right]) => left.localeCompare(right, 'en'));

  return Object.fromEntries([...refreshed, ...added]);
}

// New ids whose first segment names an existing feature catalog (tx.row.x -> tx.json)
// belong in that catalog; the rest go to the legacy bundle.
export function splitNewMessages(newMessages, featureFileNames) {
  const features = {};
  const legacy = {};

  for (const [messageId, message] of Object.entries(newMessages)) {
    const featureFileName = `${messageId.split('.')[0]}.json`;

    if (featureFileNames.includes(featureFileName)) {
      features[featureFileName] = { ...features[featureFileName], [messageId]: message };
    } else {
      legacy[messageId] = message;
    }
  }

  return { legacy, features };
}

// Every English id that a translated locale lacks, with the English text as the
// starting point for the translator. Empty when the locale is complete.
export function findNeedsTranslation(englishMessages, translatedMessagesByLocale) {
  return Object.fromEntries(
    Object.entries(translatedMessagesByLocale).map(([locale, translatedMessages]) => [
      locale,
      Object.fromEntries(
        Object.entries(englishMessages).filter(([messageId]) => !(messageId in translatedMessages)),
      ),
    ]),
  );
}

function readCatalog(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readLocaleMessages(localesDirectory, locale) {
  const messages = { ...readCatalog(join(localesDirectory, `${locale}.json`)) };

  for (const fileName of readdirSync(join(localesDirectory, locale)).sort()) {
    if (fileName.endsWith('.json')) {
      Object.assign(messages, readCatalog(join(localesDirectory, locale, fileName)));
    }
  }

  return messages;
}

function writeLegacyMessages(extractedMessagesPath, featureDirectory, legacyMessagesPath) {
  const extractedLegacyMessages = excludeFeatureMessages(
    readCatalog(extractedMessagesPath),
    readFeatureMessageIds(featureDirectory),
  );
  const existingLegacyMessages = readCatalog(legacyMessagesPath);
  const newMessages = Object.fromEntries(
    Object.entries(extractedLegacyMessages).filter(
      ([messageId]) => !(messageId in existingLegacyMessages),
    ),
  );
  const knownMessages = Object.fromEntries(
    Object.entries(extractedLegacyMessages).filter(
      ([messageId]) => messageId in existingLegacyMessages,
    ),
  );
  const { legacy, features } = splitNewMessages(
    newMessages,
    readdirSync(featureDirectory).filter((fileName) => fileName.endsWith('.json')),
  );
  const legacyMessages = mergeLegacyMessages(existingLegacyMessages, {
    ...knownMessages,
    ...legacy,
  });

  writeFileSync(legacyMessagesPath, `${JSON.stringify(legacyMessages, null, 2)}\n`);

  for (const [fileName, messages] of Object.entries(features)) {
    const featurePath = join(featureDirectory, fileName);

    writeFileSync(
      featurePath,
      `${JSON.stringify(mergeLegacyMessages(readCatalog(featurePath), messages), null, 2)}\n`,
    );
  }
}

function writeNeedsTranslation(legacyMessagesPath, needsTranslationPath) {
  const localesDirectory = dirname(legacyMessagesPath);
  const translatedMessagesByLocale = Object.fromEntries(
    TRANSLATED_LOCALES.map((locale) => [locale, readLocaleMessages(localesDirectory, locale)]),
  );
  const needsTranslation = findNeedsTranslation(
    readLocaleMessages(localesDirectory, 'en'),
    translatedMessagesByLocale,
  );

  writeFileSync(needsTranslationPath, `${JSON.stringify(needsTranslation, null, 2)}\n`);

  for (const locale of TRANSLATED_LOCALES) {
    console.log(
      `needs translation (${locale}): ${Object.keys(needsTranslation[locale]).length} ids -> ${needsTranslationPath}`,
    );
  }
}

const [extractedMessagesPath, featureDirectory, legacyMessagesPath, needsTranslationPath] =
  process.argv.slice(2);

if (extractedMessagesPath && featureDirectory && legacyMessagesPath) {
  writeLegacyMessages(extractedMessagesPath, featureDirectory, legacyMessagesPath);

  if (needsTranslationPath) {
    writeNeedsTranslation(legacyMessagesPath, needsTranslationPath);
  }
}
