import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '41740', 10);
const apiTarget = new URL(process.env.API_TARGET ?? 'http://127.0.0.1:41741');
const webRoot = path.resolve('dist');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function proxyApi(request, response) {
  const target = new URL(request.url ?? '/', apiTarget);
  const upstream = http.request(
    target,
    {
      method: request.method,
      headers: { ...request.headers, host: target.host },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'BAD_GATEWAY', message: 'API server unavailable' } }));
  });
  request.pipe(upstream);
}

async function serveAsset(request, response) {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${host}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let assetPath = path.resolve(webRoot, relativePath);
  const relativeToRoot = path.relative(webRoot, assetPath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403).end();
    return;
  }

  try {
    if (!(await stat(assetPath)).isFile()) throw new Error('Not a file');
  } catch {
    assetPath = path.join(webRoot, 'index.html');
  }

  const fileStats = await stat(assetPath);
  response.writeHead(200, {
    'cache-control': assetPath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    'content-length': fileStats.size,
    'content-type': contentTypes.get(path.extname(assetPath).toLowerCase()) ?? 'application/octet-stream',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(assetPath).pipe(response);
}

const server = http.createServer((request, response) => {
  if ((request.url ?? '').startsWith('/api/')) {
    proxyApi(request, response);
    return;
  }
  void serveAsset(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.listen(port, host);

function shutdown() {
  server.closeIdleConnections();
  server.close(() => process.exit(0));
  setTimeout(() => {
    server.closeAllConnections();
    process.exit(0);
  }, 500).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
