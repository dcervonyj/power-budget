import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// CLN-062: proves the style ratchet in eslint.ratchet.js fires. Lints source text under an existing
// design-tokens file path (so type-aware rules resolve tsconfig) with the repo's root config.
// typescript-eslint infers a "single run" when CI=true and then parses the file on disk instead of the text given to
// lintText, so the first lintText would see the unchanged index.ts and report nothing. A real `eslint` run lints disk
// content, so this only affects this test; turn the inference off so the fixture text is what gets parsed.
process.env.TSESTREE_SINGLE_RUN = 'false';

const repoRoot = resolve(__dirname, '../../..');
const filePath = resolve(repoRoot, 'packages/design-tokens/src/index.ts');
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: resolve(repoRoot, 'eslint.config.js'),
});

async function ruleIds(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });

  return result.messages.map((message) => message.ruleId ?? 'parse-error');
}

describe('style ratchet', () => {
  it('flags a braceless if', async () => {
    expect(
      await ruleIds(
        'export const f = (a: boolean): number => {\n  if (a) return 1;\n\n  return 2;\n};\n',
      ),
    ).toContain('curly');
  });

  it('flags a return glued to the previous statement', async () => {
    expect(
      await ruleIds('export const f = (): number => {\n  const a = 1;\n  return a;\n};\n'),
    ).toContain('padding-line-between-statements');
  });

  it('flags a lodash import', async () => {
    expect(await ruleIds("import { chunk } from 'lodash';\n\nexport const f = chunk;\n")).toContain(
      '@typescript-eslint/no-restricted-imports',
    );
  });

  it('flags a non-exhaustive switch over a union', async () => {
    const code =
      "export function f(v: 'a' | 'b'): number {\n  switch (v) {\n    case 'a':\n      return 1;\n  }\n\n  return 0;\n}\n";

    expect(await ruleIds(code)).toContain('@typescript-eslint/switch-exhaustiveness-check');
  });

  it('flags a *Helper name but not FormHelperText as an object key', async () => {
    expect(await ruleIds('export class ParseHelper {}\n')).toContain(
      '@typescript-eslint/naming-convention',
    );
    expect(await ruleIds('export const props = { FormHelperText: 1 };\n')).not.toContain(
      '@typescript-eslint/naming-convention',
    );
  });

  it('flags private before public members', async () => {
    const code = 'export class A {\n  private b(): void {}\n\n  c(): void {}\n}\n';

    expect(await ruleIds(code)).toContain('@typescript-eslint/member-ordering');
  });
});
