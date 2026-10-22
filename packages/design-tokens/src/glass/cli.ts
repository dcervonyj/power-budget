import { fileURLToPath } from 'node:url';
import { glassCss } from './css.js';
import { glassDarkTheme, glassLightTheme } from './tokens.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(glassCss(glassDarkTheme, glassLightTheme));
}
