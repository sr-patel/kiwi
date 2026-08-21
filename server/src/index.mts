import { createServer } from 'node:http';
import { createApplication } from './app.mjs';
import { logger } from './logger.mjs';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const { app, context } = await createApplication();
const server = createServer(app);

server.requestTimeout = 5 * 60_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 60_000;

server.listen(port, host, () => logger.info({ host, port }, 'Kiwi API listening'));

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const serverClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server.closeIdleConnections();
  const forceCloseTimer = setTimeout(
    () => {
      logger.warn('Draining HTTP connections timed out; closing remaining connections');
      server.closeAllConnections();
    },
    process.env.NODE_ENV === 'test' ? 500 : 10_000,
  );

  const results = await Promise.allSettled([serverClosed, context.close()]);
  clearTimeout(forceCloseTimer);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length > 0) {
    logger.error({ errors: failures.map(({ reason }) => reason) }, 'Server shutdown failed');
    server.closeAllConnections();
    process.exitCode = 1;
  } else {
    logger.info('Graceful shutdown complete');
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
