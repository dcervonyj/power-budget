import { resolve } from 'node:path';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';

// Strings only the ICU parser contains (its error kinds); they never appear in no-parser builds.
const PARSER_SIGNATURES = [
  'EXPECT_ARGUMENT_CLOSING_BRACE',
  'INVALID_ARGUMENT_TYPE',
  'UNMATCHED_CLOSING_TAG',
];

function chunksOf(
  result: Rollup.RollupOutput | Rollup.RollupOutput[] | Rollup.RollupWatcher,
): Rollup.OutputChunk[] {
  const outputs = Array.isArray(result) ? result : [result];

  return outputs.flatMap((output) =>
    'output' in output
      ? output.output.filter((item): item is Rollup.OutputChunk => item.type === 'chunk')
      : [],
  );
}

describe('production bundle', () => {
  it('ships no ICU message parser in any chunk (CLN-074d)', async () => {
    const result = await build({
      configFile: resolve(__dirname, '../../vite.config.ts'),
      logLevel: 'silent',
      build: { write: false, outDir: resolve(__dirname, '../../dist-bundle-check') },
    });

    const chunks = chunksOf(result);
    const offenders = chunks
      .filter((chunk) => PARSER_SIGNATURES.some((signature) => chunk.code.includes(signature)))
      .map((chunk) => chunk.fileName);

    expect(chunks.some((chunk) => chunk.isEntry)).toBe(true);
    expect(offenders).toEqual([]);
  }, 120000);
});
