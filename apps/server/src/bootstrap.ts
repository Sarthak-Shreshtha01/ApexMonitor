import { createApp } from './app';
import { closeMongo, connectMongo } from '@infrastructure/db/mongo';
import { closePostgres, connectPostgres, ensureSchemaUpToDate } from '@infrastructure/db/postgres';
import { closeRedis, connectRedis } from '@infrastructure/redis';
import { closeRabbitMQ, connectRabbitMQ, inFlightMessages, stopConsuming } from '@infrastructure/rabbitmq';
import { markShuttingDown, runShutdown, waitUntil } from '@shared/lifecycle';
import { config } from '@config';
import http from 'http';
import { RawLogWorker } from '@workers/raw-log.worker';
import { AggregationWorker } from '@workers/aggregation.worker';
import { WebSocketService } from '@modules/websocket';
import { AnomalyWorker } from '@workers/anomaly.worker';
import { AlertWorker } from '@workers/alert.worker';
import { RumWorker } from '@workers/rum.worker';

async function bootstrap() {
  try {
    console.log('⏳ Bootstrapping ApexMonitor Infrastructure...');
    
    // 1. Connect all infrastructure
    await Promise.all([
      connectMongo(),
      connectPostgres(),
      connectRedis(),
      connectRabbitMQ()
    ]);

    // 2. Schema must be current before workers or HTTP use the database
    await ensureSchemaUpToDate();

    // Initialize Background Workers
    console.log('⏳ Starting background workers...');
    const rawLogWorker = new RawLogWorker();
    // await rawLogWorker.start();
    const aggregationWorker = new AggregationWorker();
    const anomalyWorker = new AnomalyWorker();
    const alertWorker = new AlertWorker();
    const rumWorker = new RumWorker();
    
    await Promise.all([
      rawLogWorker.start(),
      aggregationWorker.start(),
      anomalyWorker.start(),
      rumWorker.start(),
    ]);
    alertWorker.start()

    // 2. Start HTTP Server
    const app = createApp();
    const server = http.createServer(app);

    // Initialize WebSocket Server (Pass the HTTP server instance)
    const wsService = new WebSocketService(server);

    server.listen(config.PORT, () => {
      console.log(`🚀 ApexMonitor running on http://localhost:${config.PORT}`);
    });

    // Graceful shutdown (KI-21): finish what is in flight, then close every connection.
    let stopping = false;
    const shutdown = async (signal: string) => {
      if (stopping) return; // a second signal while stopping changes nothing
      stopping = true;
      console.log(`${signal} received, shutting down (limit ${config.SHUTDOWN_TIMEOUT_MS} ms)`);
      markShuttingDown(); // /ready now answers 503
      const httpClosed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeIdleConnections();

      const result = await runShutdown([
        { name: 'disconnect websocket clients', run: () => wsService.close() },
        {
          name: 'finish in-flight HTTP requests',
          run: async () => {
            const done = await Promise.race([httpClosed.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 10_000))]);
            if (!done) {
              server.closeAllConnections(); // stragglers after 10 s are cut off
              await httpClosed;
            }
          },
        },
        { name: 'stop alert evaluation', run: async () => { alertWorker.stop(); await waitUntil(() => !alertWorker.isBusy(), 10_000); } },
        { name: 'drain queue consumers', run: async () => { if (!(await stopConsuming(10_000))) throw new Error(`${inFlightMessages()} message(s) still in flight; they will be redelivered`); } },
        { name: 'close RabbitMQ', run: closeRabbitMQ },
        { name: 'close MongoDB', run: closeMongo },
        { name: 'close PostgreSQL', run: closePostgres },
        { name: 'close Redis', run: closeRedis },
      ], config.SHUTDOWN_TIMEOUT_MS, (line) => console.log(`[shutdown] ${line}`));

      process.exit(result.timedOut || result.failed.length > 0 ? 1 : 0);
    };
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();