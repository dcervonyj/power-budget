export function readFeatureMessageIds(featureDirectory: string): Set<string>;
export function excludeFeatureMessages(
  extractedMessages: Record<string, string>,
  featureMessageIds: Set<string>,
): Record<string, string>;
export function mergeLegacyMessages(
  existingLegacyMessages: Record<string, string>,
  extractedLegacyMessages: Record<string, string>,
): Record<string, string>;
export function findNeedsTranslation(
  englishMessages: Record<string, string>,
  translatedMessagesByLocale: Record<string, Record<string, string>>,
): Record<string, Record<string, string>>;
export function splitNewMessages(
  newMessages: Record<string, string>,
  featureFileNames: string[],
): { legacy: Record<string, string>; features: Record<string, Record<string, string>> };
