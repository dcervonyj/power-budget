import { ESLint } from 'eslint';
import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, '../../..');
const tsParser = require('@typescript-eslint/parser');
const { layerLintBlocks, backendLayerBlocks, LAYER_ALLOW_LIST } = require(
  path.join(root, 'eslint.layers.js'),
) as {
  layerLintBlocks: unknown[];
  backendLayerBlocks: (prefix: string) => unknown[];
  LAYER_ALLOW_LIST: string[];
};

// Same blocks as the root eslint.config.js, but without type-aware parsing so virtual files can be linted.
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tsParser } },
    ...layerLintBlocks,
  ] as never,
});

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, filePath) });
  return result.messages.map((m) => m.ruleId ?? 'parse-error');
}

const RESTRICTED = ['no-restricted-imports'];

describe('layer lint (no-restricted-imports)', () => {
  it.each([
    ['packages/backend/src/domain/plans/x.ts', `import { A } from '../../application/plans/A.js';`],
    ['packages/backend/src/domain/plans/x.ts', `import { A } from '../../infrastructure/db/A.js';`],
    ['packages/backend/src/domain/plans/x.ts', `import { createHash } from 'node:crypto';`],
    [
      'packages/backend/src/application/plans/x.ts',
      `import { A } from '../../infrastructure/db/A.js';`,
    ],
    [
      'packages/backend/src/application/plans/x.ts',
      `import { A } from '../../presentation/http/A.js';`,
    ],
    ['packages/backend/src/application/plans/x.ts', `import { Injectable } from '@nestjs/common';`],
    ['packages/backend/src/application/plans/x.ts', `import { uuidv7 } from 'uuidv7';`],
    [
      'packages/backend/src/infrastructure/db/x.ts',
      `import { A } from '../../presentation/http/A.js';`,
    ],
    ['packages/web/src/domain/x.ts', `import { A } from '../application/A.js';`],
    ['packages/web/src/application/x/x.ts', `import { A } from '../../infrastructure/api/A.js';`],
    [
      'packages/web/src/application/x/x.ts',
      `import type { A } from '../../presentation/components/A.js';`,
    ],
    ['packages/web/src/application/x/x.ts', `import React from 'react';`],
    ['packages/web/src/infrastructure/x/x.ts', `import { A } from '../../presentation/A.js';`],
    [
      'packages/shared-app/src/plans/application/x.ts',
      `import { A } from '../../infrastructure/A.js';`,
    ],
    ['packages/shared-app/src/plans/application/x.ts', `import { A } from '../../infrastructure';`],
    ['packages/shared-app/src/plans/application/x.ts', `import React from 'react';`],
    ['packages/mobile/src/domain/x.ts', `import { A } from '../presentation/A.js';`],
    ['packages/mobile/src/infrastructure/x/x.ts', `import { A } from '../../presentation/A.js';`],
  ])('errors for %s: %s', async (file, code) => {
    expect(await ruleIds(file, code)).toEqual(RESTRICTED);
  });

  it.each([
    ['packages/backend/src/application/plans/x.ts', `import { A } from '../../domain/plans/A.js';`],
    [
      'packages/backend/src/infrastructure/db/x.ts',
      `import { A } from '../../application/plans/A.js';`,
    ],
    ['packages/backend/src/infrastructure/db/x.ts', `import { Injectable } from '@nestjs/common';`],
    [
      'packages/backend/src/presentation/http/x.ts',
      `import { A } from '../../application/plans/A.js';`,
    ],
    ['packages/web/src/presentation/x.tsx', `import { A } from '../infrastructure/A.js';`],
    ['packages/web/src/application/x/x.ts', `import { A } from '../../domain/A.js';`],
    ['packages/shared-app/src/plans/application/x.ts', `import { A } from '../domain/A.js';`],
  ])('allows %s: %s', async (file, code) => {
    expect(await ruleIds(file, code)).toEqual([]);
  });

  it.each([
    ['packages/web/src/application/x/x.ts', `import { A } from '../../presentation';`],
    ['packages/web/src/application/x/x.ts', `import { A } from '../../presentation/index.js';`],
    ['packages/web/src/application/x/x.ts', `import { A } from '../../infrastructure';`],
    ['packages/backend/src/domain/plans/x.ts', `import { A } from '../../application';`],
    ['packages/backend/src/infrastructure/db/x.ts', `import { A } from '../presentation';`],
  ])('bare or index layer import errors for %s: %s', async (file, code) => {
    expect(await ruleIds(file, code)).toEqual(RESTRICTED);
  });

  describe('allow-list uses per-import disable comments', () => {
    const file = 'packages/web/src/application/bank/ConsentRenewal.ts';
    const known = `// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list\nimport { A } from '../../infrastructure/api/A.js';\n`;

    it('is documented in the central list', () => {
      expect(LAYER_ALLOW_LIST).toContain(file);
    });

    it('the known import passes', async () => {
      expect(await ruleIds(file, known)).toEqual([]);
    });

    it('a NEW forbidden import in the same file still errors', async () => {
      expect(
        await ruleIds(file, `${known}import { B } from '../../infrastructure/api/B.js';\n`),
      ).toEqual(RESTRICTED);
    });
  });

  it('backend blocks also fire when linting from packages/backend (its own config base dir)', async () => {
    const backendRoot = path.join(root, 'packages/backend');
    const fromBackend = new ESLint({
      cwd: backendRoot,
      overrideConfigFile: true,
      overrideConfig: [
        { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
        ...backendLayerBlocks(''),
      ] as never,
    });
    const [result] = await fromBackend.lintText(
      `import { A } from '../../infrastructure/db/A.js';`,
      {
        filePath: path.join(backendRoot, 'src/application/plans/x.ts'),
      },
    );
    expect(result.messages.map((m) => m.ruleId)).toEqual(RESTRICTED);
  });

  it('shared-app application rules resolve from its lint base dir with the real root config', async () => {
    const sharedApp = path.join(root, 'packages/shared-app');
    const fromSharedApp = new ESLint({ cwd: sharedApp });
    const config = await fromSharedApp.calculateConfigForFile(
      path.join(sharedApp, 'src/plans/application/x.ts'),
    );
    const [severity, options] = config.rules['no-restricted-imports'];
    expect(severity).toBe(2);
    expect(options.patterns[0].group).toEqual(
      expect.arrayContaining([
        '**/infrastructure',
        '**/infrastructure/**',
        '**/presentation',
        '**/presentation/**',
      ]),
    );
  });
});
