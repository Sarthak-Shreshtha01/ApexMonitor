import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '@config';
import { ingestRouter } from '@modules/ingest';
import { metricsRouter } from '@modules/metrics/metrics.router';
import { authRouter } from '@modules/auth/auth.router';
import { userRouter } from '@modules/users/user.router';
import { billingRouter } from '@modules/billing/billing.router';
import { projectsRouter } from '@modules/projects/projects.router';
import { logsRouter } from '@modules/logs/logs.router';
import { insightsRouter } from '@modules/insights/insights.router';
import { keysRouter } from '@modules/keys/keys.router';
import { tracesRouter } from '@modules/traces/traces.router';
import { API_PREFIX, HEALTH_ENDPOINT, SERVER_ENDPOINTS } from '@shared/constants/endpoints';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' })); // Max batch size protection

  app.get(HEALTH_ENDPOINT, (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API v1 Routes
  const v1 = express.Router();
  v1.use(SERVER_ENDPOINTS.modules.auth, authRouter);
  v1.use(SERVER_ENDPOINTS.modules.ingest, ingestRouter);
  v1.use(SERVER_ENDPOINTS.modules.metrics, metricsRouter);
  v1.use(SERVER_ENDPOINTS.modules.users, userRouter);
  v1.use(SERVER_ENDPOINTS.modules.billing, billingRouter);
  v1.use(SERVER_ENDPOINTS.modules.projects, projectsRouter);
  v1.use(SERVER_ENDPOINTS.modules.logs, logsRouter);
  v1.use(SERVER_ENDPOINTS.modules.insights, insightsRouter);
  v1.use(SERVER_ENDPOINTS.modules.keys, keysRouter);
  v1.use(SERVER_ENDPOINTS.modules.traces, tracesRouter);
  
  app.use(API_PREFIX, v1);

  // Fallback Error Handler (We will build a proper one in a later step)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  return app;
}