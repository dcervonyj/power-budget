export function readFeatureMessageIds(featureDirectory: string): Set<string>;
export function excludeFeatureMessages(
  extractedMessages: Record<string, string>,
  featureMessageIds: Set<string>,
): Record<string, string>;
