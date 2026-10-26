// Serves dist-gallery on :4175 (the `expo export --platform web` output of the gallery build).
// Plain node, so it also runs inside the Playwright docker image (see visual/run-in-docker.sh).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '../dist-gallery');
const PORT = 4175;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const file = join(ROOT, normalize(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end();

    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(PORT);
