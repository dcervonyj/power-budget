#!/usr/bin/env node
/**
 * Negative fixture test: proves that importing 'react' from @power-budget/core
 * is rejected by ESLint. The test passes when ESLint exits non-zero on the probe.
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixtureSource = join(__dirname, '../__fixtures__/banned-imports.fixture.ts.txt');
const probe = join(__dirname, '../src/__bans-probe__.ts');

// Cleanup on exit
process.on('exit', () => {
  if (existsSync(probe)) rmSync(probe);
});
process.on('SIGINT', () => process.exit(1));

try {
  cpSync(fixtureSource, probe);

  let eslintFailed = false;
  try {
    execSync(`npx eslint "${probe}"`, {
      cwd: join(__dirname, '..'),
      stdio: 'pipe',
    });
  } catch {
    eslintFailed = true;
  }

  if (!eslintFailed) {
    console.error(
      '❌ FAIL: ESLint did NOT reject the banned import. The no-restricted-imports rule is not working!',
    );
    process.exit(1);
  }

  console.log('✅ PASS: ESLint correctly rejected the banned react import.');
  process.exit(0);
} finally {
  if (existsSync(probe)) rmSync(probe);
}
