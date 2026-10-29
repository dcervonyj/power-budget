// DSN-031: the production export (EXPO_PUBLIC_GALLERY unset) must not contain the gallery.
// Run with `pnpm test:export`; the CI `visual-mobile` job runs it after building the gallery,
// whose export (dist-gallery) is the positive control: it must contain the markers.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

const MOBILE_DIR = join(import.meta.dirname, '..');
const GALLERY_DIR = join(MOBILE_DIR, 'dist-gallery');
// Strings that only exist in the gallery sources.
const MARKERS = ['gallery-main', 'gallery-index', 'Token swatches', 'EXPO_PUBLIC_GALLERY'];
// Expo inlines `process.env.EXPO_PUBLIC_*` only in the literal dot form (CLN-089).
const TEST_SENTRY_DSN = 'https://public@o0.ingest.de.sentry.io/0';

function bundleText(dir) {
  const jsDir = join(dir, '_expo/static/js/web');

  return readdirSync(jsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(join(jsDir, name), 'utf8'))
    .join('\n');
}

describe('production web export', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'pb-mobile-export-'));
  after(() => rmSync(outDir, { recursive: true, force: true }));

  it('does not contain the gallery and inlines the Sentry DSN', () => {
    const { EXPO_PUBLIC_GALLERY: _gallery, ...env } = process.env;
    execFileSync('pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', outDir], {
      cwd: MOBILE_DIR,
      env: { ...env, EXPO_PUBLIC_SENTRY_DSN: TEST_SENTRY_DSN },
      stdio: 'inherit',
    });

    const bundle = bundleText(outDir);
    for (const marker of MARKERS) {
      assert.equal(bundle.includes(marker), false, `production bundle contains "${marker}"`);
    }
    assert.equal(bundle.includes(TEST_SENTRY_DSN), true, 'production bundle misses the Sentry DSN');
  });

  it(
    'is told apart from the gallery export by the same markers',
    { skip: !existsSync(GALLERY_DIR) },
    () => {
      const bundle = bundleText(GALLERY_DIR);
      for (const marker of ['gallery-main', 'gallery-index', 'Token swatches']) {
        assert.equal(bundle.includes(marker), true, `gallery bundle misses "${marker}"`);
      }
    },
  );
});
