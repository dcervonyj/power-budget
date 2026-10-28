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
const backendFilePath = resolve(repoRoot, 'packages/backend/src/app.module.ts');
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: resolve(repoRoot, 'eslint.config.js'),
});

async function ruleIds(code: string, path: string = filePath): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path });

  return result.messages.map((message) => message.ruleId ?? 'parse-error');
}

describe('style ratchet', { timeout: 60_000 }, () => {
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

  describe('no function locals in class methods', () => {
    const rule = 'ratchet-local/no-function-local-in-method';
    const method = (body: string): string => `export class A {\n  run(): void {\n${body}\n  }\n}\n`;

    it.each([
      ['an arrow local', 'const f = (): number => 1;\n    f();'],
      ['an `as` wrapped arrow', 'const f = ((): number => 1) as () => number;\n    f();'],
      [
        'a `satisfies` wrapped arrow',
        'const f = ((): number => 1) satisfies () => number;\n    f();',
      ],
      ['an angle-bracket wrapped arrow', 'const f = <() => number>(() => 1);\n    f();'],
      ['a nested function declaration', 'function f(): number {\n      return 1;\n    }\n    f();'],
      [
        'a local in a nested block',
        'if (Math.random()) {\n      const f = (): number => 1;\n      f();\n    }',
      ],
    ])('flags %s', async (_name, body) => {
      expect(await ruleIds(method(body), backendFilePath)).toContain(rule);
    });

    it.each([
      ['an inline callback', '[1].map((x) => x + 1);'],
      [
        'a local inside an inline callback',
        '[1].forEach((x) => {\n      const g = (): number => x;\n      g();\n    });',
      ],
    ])('allows %s', async (_name, body) => {
      expect(await ruleIds(method(body), backendFilePath)).not.toContain(rule);
    });

    it.each(['shared-app', 'web', 'mobile', 'core', 'design-tokens'])(
      'flags an arrow local in %s src',
      async (pkg) => {
        const path = resolve(repoRoot, `packages/${pkg}/src/index.ts`);

        expect(await ruleIds(method('const f = (): number => 1;\n    f();'), path)).toContain(rule);
      },
    );

    it.each([
      ['web', 'packages/web/src/main.tsx'],
      ['mobile', 'packages/mobile/src/gallery/main.tsx'],
    ])('flags locals in a class method of a %s .tsx file', async (_pkg, file) => {
      const path = resolve(repoRoot, file);

      expect(await ruleIds(method('const f = (): number => 1;\n    f();'), path)).toContain(rule);
      expect(
        await ruleIds(method('function g(): number {\n      return 1;\n    }\n    g();'), path),
      ).toContain(rule);
    });

    it('does not apply to test files', async () => {
      const path = resolve(repoRoot, 'packages/core/src/index.spec.ts');

      expect(await ruleIds(method('const f = (): number => 1;\n    f();'), path)).not.toContain(
        rule,
      );
    });
  });

  describe('no non-null assertion and no `??=` in production code', () => {
    const bang = 'export const f = (a: string | null): string => a!;\n';
    const assign = "export function f(o: { a?: string }): void {\n  o.a ??= 'x';\n}\n";
    const bangRule = '@typescript-eslint/no-non-null-assertion';

    it.each(['backend', 'shared-app', 'web', 'mobile', 'core', 'design-tokens'])(
      'flags a `!` and a `??=` in %s src',
      async (pkg) => {
        const path =
          pkg === 'backend' ? backendFilePath : resolve(repoRoot, `packages/${pkg}/src/index.ts`);

        expect(await ruleIds(bang, path)).toContain(bangRule);
        expect(await ruleIds(assign, path)).toContain('no-restricted-syntax');
      },
    );

    it('flags a `??=` in mobile presentation, which has its own no-restricted-syntax block', async () => {
      const path = resolve(repoRoot, 'packages/mobile/src/presentation/App.tsx');

      expect(await ruleIds(assign, path)).toContain('no-restricted-syntax');
    });

    it('exempts test files', async () => {
      const path = resolve(repoRoot, 'packages/core/src/index.spec.ts');

      expect(await ruleIds(bang, path)).not.toContain(bangRule);
      expect(await ruleIds(assign, path)).not.toContain('no-restricted-syntax');
    });
  });

  describe('mobile presentation keeps the CLN-036 contract-Dto selector next to the `??=` ban', () => {
    const path = resolve(repoRoot, 'packages/mobile/src/presentation/App.tsx');
    const call = (type: string): string =>
      `declare const apiClient: { get<T>(url: string): T };\nexport const r = apiClient.get<${type}>('/x');\n`;

    it('flags a local response type', async () => {
      expect(await ruleIds(call('{ id: string }'), path)).toContain('no-restricted-syntax');
    });

    it('allows a contract *Dto type', async () => {
      expect(await ruleIds(call('FooDto'), path)).not.toContain('no-restricted-syntax');
    });
  });
});
