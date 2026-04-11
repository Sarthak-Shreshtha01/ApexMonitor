import { createApp } from './app';
import { connectMongo } from '@infrastructure/db/mongo';
import { connectPostgres } from '@infrastructure/db/postgres';
import { connectRedis } from '@infrastructure/redis';
import { connectRabbitMQ } from '@infrastructure/rabbitmq';
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

    // Graceful Shutdown Handler
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => process.exit(0));
    });

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();