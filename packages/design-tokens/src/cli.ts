// CLI entry point — Node.js only. Not exported from the package index.
// Generates dist/tokens.css when run directly: `node dist/cli.js > dist/tokens.css`
import { fileURLToPath } from 'node:url';
import { darkTheme, lightTheme } from './tokens.js';
import { themesToCss } from './css.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(themesToCss(darkTheme, lightTheme));
}
