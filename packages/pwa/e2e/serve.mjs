// Serves a build under /flow/, the same path it has on GitHub Pages, so the tests catch
// anything that assumes it lives at the root of a domain. Takes a build folder and port.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const [folder = 'dist', port = '4179'] = process.argv.slice(2);
const ROOT = fileURLToPath(new URL(`../${folder}`, import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/flow/')) {
    res.writeHead(404).end('Only /flow/ exists here');
    return;
  }
  const relative = path.slice('/flow/'.length) || 'index.html';
  try {
    const body = await readFile(join(ROOT, normalize(relative)));
    res.writeHead(200, { 'Content-Type': TYPES[extname(relative)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(Number(port), 'localhost');
