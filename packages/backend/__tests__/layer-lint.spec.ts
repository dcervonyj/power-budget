import { ESLint } from 'eslint';
import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, '../../..');
const tsParser = require('@typescript-eslint/parser');
const { layerLintBlocks, layerAllowListBlocks, LAYER_ALLOW_LIST } = require(
  path.join(root, 'eslint.layers.js'),
) as {
  layerLintBlocks: unknown[];
  layerAllowListBlocks: unknown[];
  LAYER_ALLOW_LIST: string[];
};

// Same blocks as the root eslint.config.js, but without type-aware parsing so virtual files can be linted.
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tsParser } },
    ...layerLintBlocks,
    ...layerAllowListBlocks,
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
  ])('allows %s: %s', async (file, code) => {
    expect(await ruleIds(file, code)).toEqual([]);
  });

  it('allow-listed file may keep its violation', async () => {
    expect(LAYER_ALLOW_LIST).toContain('packages/web/src/application/bank/ConsentRenewal.ts');
    expect(
      await ruleIds(
        'packages/web/src/application/bank/ConsentRenewal.ts',
        `import { A } from '../../infrastructure/api/A.js';`,
      ),
    ).toEqual([]);
  });
});
