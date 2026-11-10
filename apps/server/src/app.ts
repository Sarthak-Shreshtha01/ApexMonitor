import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
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
import { rumRouter } from '@modules/rum';
import { alertsRouter } from '@modules/alerts/alerts.router';
import { API_PREFIX, HEALTH_ENDPOINT, SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { errorHandler, notFoundHandler } from '@shared/middleware/error-handler';
import { httpLoggerOptions } from '@shared/utils/logger';
import { PlatformController } from '@shared/http/platform-controller';
import { isShuttingDown } from '@shared/lifecycle';

export function createApp(): Application {
  const app = express();
  const platformController = new PlatformController();

  // While shutting down, close each keep-alive connection after its current response so
  // server.close() can finish and clients reconnect to another instance.
  app.use((_req, res, next) => {
    if (isShuttingDown()) res.setHeader('Connection', 'close');
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' })); // Max batch size protection
  // Express 5 leaves req.body undefined when no body is sent; handlers and DTOs expect an object.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use(pinoHttp(httpLoggerOptions())); // redacts tokens, keys and cookies

  app.use((req, res, next) => {
    const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
    (req as express.Request & { id?: string }).id = requestId;
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    next();
  });

  // Platform-level probes used by load balancers and operators.
  app.get(HEALTH_ENDPOINT, platformController.health);
  app.get('/ready', platformController.ready);
  app.get('/metrics/system', platformController.metrics);

  // Mount API v1 Routes
  const v1 = express.Router();
  v1.use(SERVER_ENDPOINTS.modules.auth, authRouter);
  v1.use(SERVER_ENDPOINTS.modules.ingest, ingestRouter);
  v1.use(SERVER_ENDPOINTS.modules.rum, rumRouter);
  v1.use(SERVER_ENDPOINTS.modules.metrics, metricsRouter);
  v1.use(SERVER_ENDPOINTS.modules.users, userRouter);
  v1.use(SERVER_ENDPOINTS.modules.billing, billingRouter);
  v1.use(SERVER_ENDPOINTS.modules.projects, projectsRouter);
  v1.use(SERVER_ENDPOINTS.modules.logs, logsRouter);
  v1.use(SERVER_ENDPOINTS.modules.insights, insightsRouter);
  v1.use(SERVER_ENDPOINTS.modules.keys, keysRouter);
  v1.use(SERVER_ENDPOINTS.modules.traces, tracesRouter);
  v1.use(SERVER_ENDPOINTS.modules.alerts, alertsRouter);
  
  app.use(API_PREFIX, v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}