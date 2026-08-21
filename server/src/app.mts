import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { AppError, errorMessage } from './errors.mjs';
import { logger } from './logger.mjs';
import { ConfigRepository } from './config-repository.mjs';
import { LibraryContextManager } from './library-context.mjs';
import { createConfigRouter } from './routes/config-routes.mjs';
import { createFolderRouter } from './routes/folder-routes.mjs';
import { createLibraryRouter, createPhotoRouter, createSearchRouter } from './routes/photo-routes.mjs';
import { createSystemRouter } from './routes/system-routes.mjs';
import { createTagRouter } from './routes/tag-routes.mjs';

function developmentCors(): RequestHandler {
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowed = new Set(
    (process.env.CORS_ORIGINS ?? defaults.join(',')).split(',').map((origin) => origin.trim()),
  );
  return (request, response, next) => {
    const origin = request.headers.origin;
    if (origin && allowed.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(origin && allowed.has(origin) ? 204 : 403);
      return;
    }
    next();
  };
}

export interface KiwiApplication {
  app: express.Express;
  context: LibraryContextManager;
}

export async function createApplication(): Promise<KiwiApplication> {
  const app = express();
  const context = new LibraryContextManager(new ConfigRepository());
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      genReqId(request, response) {
        const provided = request.headers['x-request-id'];
        const requestId = typeof provided === 'string' && provided.length <= 128 ? provided : randomUUID();
        response.setHeader('X-Request-ID', requestId);
        return requestId;
      },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  if (process.env.NODE_ENV !== 'production') app.use(developmentCors());
  app.use(rateLimit({ windowMs: 60_000, limit: 2_000, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/api/config', createConfigRouter(context));
  app.use('/api/photos', createPhotoRouter(context));
  app.use('/api/search', createSearchRouter(context));
  app.use('/api/library', createLibraryRouter(context));
  app.use('/api/folders', createFolderRouter(context));
  app.use('/api/tags', createTagRouter(context));
  app.use('/api', createSystemRouter(context));

  app.use((_request, response) => response.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' }));

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    const requestId = response.getHeader('X-Request-ID');
    if (error instanceof AppError) {
      response.status(error.status).json({
        error: error.message,
        message: error.message,
        code: error.code,
        requestId,
        issues: error.issues,
        ...(error.code === 'NOT_CONFIGURED' ? { setup: true } : {}),
      });
      return;
    }
    request.log.error({ err: error }, 'Unhandled request error');
    response.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'production' ? 'The request could not be completed.' : errorMessage(error),
      code: 'INTERNAL_ERROR',
      requestId,
    });
  };
  app.use(errorHandler);

  await context.initialize();
  return { app, context };
}
