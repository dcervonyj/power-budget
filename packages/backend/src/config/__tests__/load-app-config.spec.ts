import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { envFilesFor, loadEnvFiles } from '../load-app-config.js';

const KEYS = ['CLN065_BOTH', 'CLN065_ROOT_ONLY', 'CLN065_REAL'];

function makeRepo(): { root: string; pkg: string; moduleDir: string; outside: string } {
  const base = mkdtempSync(join(tmpdir(), 'cln065-'));
  const root = join(base, 'repo');
  const pkg = join(root, 'packages', 'backend');
  const moduleDir = join(pkg, 'src', 'config');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  writeFileSync(join(pkg, 'package.json'), '{}');
  // A decoy .env above the repo, which a cwd-relative `../../.env` would have loaded.
  writeFileSync(join(base, '.env'), 'CLN065_BOTH=decoy\n');
  const outside = join(base, 'elsewhere');
  mkdirSync(outside);

  return { root, pkg, moduleDir, outside };
}

describe('env file loading', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    for (const key of KEYS) {
      delete process.env[key];
    }
  });

  it('locates the package and repo-root .env from the module, not the cwd', () => {
    const repo = makeRepo();
    const expected = [join(repo.pkg, '.env'), join(repo.root, '.env')];

    process.chdir(repo.root);
    const fromRoot = envFilesFor(repo.moduleDir);
    process.chdir(repo.outside);
    const fromElsewhere = envFilesFor(repo.moduleDir);

    expect(fromRoot).toEqual(expected);
    expect(fromElsewhere).toEqual(expected);
  });

  it('applies real env > package .env > root .env from either cwd', () => {
    const repo = makeRepo();
    writeFileSync(
      join(repo.root, '.env'),
      'CLN065_BOTH=root\nCLN065_ROOT_ONLY=root\nCLN065_REAL=root\n',
    );
    writeFileSync(join(repo.pkg, '.env'), 'CLN065_BOTH=package\nCLN065_REAL=package\n');

    for (const cwd of [repo.root, repo.outside]) {
      for (const key of KEYS) {
        delete process.env[key];
      }
      process.env['CLN065_REAL'] = 'real';
      process.chdir(cwd);
      loadEnvFiles(repo.moduleDir);

      expect(process.env['CLN065_REAL']).toBe('real');
      expect(process.env['CLN065_BOTH']).toBe('package');
      expect(process.env['CLN065_ROOT_ONLY']).toBe('root');
    }
  });
});
