// Dev watcher: tsc --watch recompiles src -> dist; whenever the compiled token
// modules change, regenerate dist/tokens.css and dist/glass.css so the web dev
// server (which imports those files) hot-reloads. Build output is unchanged:
// the same cli commands as the `build` script produce the CSS.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  { cli: 'dist/cli.js', out: 'dist/tokens.css' },
  { cli: 'dist/glass/cli.js', out: 'dist/glass.css' },
];
const watched = ['dist', 'dist/glass'];

function regenerate() {
  for (const { cli, out } of targets) {
    try {
      const css = execFileSync('node', [join(root, cli)], { cwd: root, encoding: 'utf8' });
      writeFileSync(join(root, out), css);
    } catch (error) {
      console.error(`[design-tokens] failed to regenerate ${out}:`, error.message);
    }
  }
  console.log('[design-tokens] regenerated tokens.css and glass.css');
}

let timer;
function schedule(_event, filename) {
  if (!filename || !filename.endsWith('.js')) {
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(regenerate, 150);
}

const tsc = spawn('pnpm', ['exec', 'tsc', '-b', '--watch', '--preserveWatchOutput'], {
  cwd: root,
  stdio: 'inherit',
});
tsc.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => tsc.kill(signal));
}

for (const dir of watched) {
  // Create the output dirs up front so a fresh checkout (no dist yet) is still watched.
  mkdirSync(join(root, dir), { recursive: true });
  watch(join(root, dir), schedule);
}
if (existsSync(join(root, 'dist/cli.js'))) {
  regenerate();
}
