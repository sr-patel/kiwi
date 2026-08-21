import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'kiwi-server' },
  redact: ['req.headers.authorization', 'config.libraryPath'],
});
