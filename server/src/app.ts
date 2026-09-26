import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { errorHandler, notFoundHandler } from './http/errors';
import { projectsRouter } from './modules/projects/projects.routes';
import { materialsRouter } from './modules/materials/materials.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api/projects', projectsRouter);
  app.use('/api/materials', materialsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
