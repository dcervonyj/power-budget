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

// A descriptor the babel plugin did not rewrite keeps its raw ICU string, which no-parser cannot format.
const RAW_ICU_DEFAULT_MESSAGE = /defaultMessage:\s*(["'`])(?:(?!\1)[^\\\n])*\{\w+\s*[,}]/;

function rawIcuIn(chunk: Rollup.OutputChunk): string[] {
  const matches = chunk.code.matchAll(new RegExp(RAW_ICU_DEFAULT_MESSAGE, 'g'));

  return [...matches].map(
    (match) => `${chunk.fileName}: ${chunk.code.slice(match.index, match.index + 120)}`,
  );
}

async function buildChunks(): Promise<Rollup.OutputChunk[]> {
  const result = await build({
    configFile: resolve(__dirname, '../../vite.config.ts'),
    logLevel: 'silent',
    build: { write: false, outDir: resolve(__dirname, '../../dist-bundle-check') },
  });

  return chunksOf(result);
}

describe('production bundle', () => {
  it('ships no ICU message parser in any chunk (CLN-074d)', async () => {
    const chunks = await buildChunks();
    const offenders = chunks
      .filter((chunk) => PARSER_SIGNATURES.some((signature) => chunk.code.includes(signature)))
      .map((chunk) => chunk.fileName);

    expect(chunks.some((chunk) => chunk.isEntry)).toBe(true);
    expect(offenders).toEqual([]);
  }, 120000);

  it('leaves no raw ICU defaultMessage that the precompile step missed', async () => {
    const chunks = await buildChunks();
    const offenders = chunks.flatMap((chunk) => rawIcuIn(chunk));

    expect(offenders).toEqual([]);
  }, 120000);
});
