import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const WEB_ROOT = join(import.meta.dirname, '../../..');
const GALLERY_MARKER = 'gallery-main';
const outDirs: string[] = [];

function buildTo(mode: string): string {
  const outDir = mkdtempSync(join(tmpdir(), `pb-web-${mode}-`));
  outDirs.push(outDir);
  // A separate process: the vitest jsdom environment breaks esbuild.
  execFileSync(
    join(WEB_ROOT, 'node_modules/.bin/vite'),
    ['build', '--mode', mode, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'silent'],
    { cwd: WEB_ROOT },
  );

  return outDir;
}

function filesOf(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' });
}

afterAll(() => {
  for (const dir of outDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('gallery build isolation (DSN-011)', () => {
  it('keeps the gallery out of the production build', () => {
    const outDir = buildTo('production');
    const files = filesOf(outDir);

    expect(files).toContain('index.html');
    expect(files.filter((file) => file.includes('gallery'))).toEqual([]);
    const scripts = files.filter((file) => file.endsWith('.js'));
    for (const script of scripts) {
      expect(readFileSync(join(outDir, script), 'utf8')).not.toContain(GALLERY_MARKER);
    }
  }, 180_000);

  it('builds gallery.html only in gallery mode', () => {
    const outDir = buildTo('gallery');
    const files = filesOf(outDir);

    expect(files).toContain('gallery.html');
    expect(files).not.toContain('index.html');
  }, 180_000);
});
