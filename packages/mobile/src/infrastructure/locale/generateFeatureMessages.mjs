import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localeDirectory = dirname(fileURLToPath(import.meta.url));
const assetsDirectory = resolve(localeDirectory, '../../../assets/locales');
const outputPath = resolve(localeDirectory, 'featureMessages.ts');
const locales = ['en', 'pl', 'ru', 'uk'];
const featureNames = readdirSync(resolve(assetsDirectory, 'en'))
  .filter((name) => name.endsWith('.json'))
  .sort();

const imports = locales.flatMap((locale) =>
  featureNames.map((featureName) => {
    const identifier = `${locale}${toIdentifier(featureName)}`;
    return `import ${identifier} from '../../../assets/locales/${locale}/${featureName}';`;
  }),
);
const catalogLists = locales.map((locale) => {
  const identifiers = featureNames.map((featureName) => `${locale}${toIdentifier(featureName)}`);
  return `  ${locale}: [${identifiers.join(', ')}],`;
});
const source = `${imports.join('\n')}
import type { SupportedLocale } from './LocaleResolver.js';

type Catalog = Record<string, string>;

export const featureMessagesByLocale: Record<SupportedLocale, readonly Catalog[]> = {
${catalogLists.join('\n')}
};
`;

writeFileSync(outputPath, source);

function toIdentifier(fileName) {
  return fileName
    .replace(/\.json$/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0] ? part[0].toUpperCase() : ''}${part.slice(1)}`)
    .join('');
}
