import { createApp } from './app';
import { connectMongo } from '@infrastructure/db/mongo';
import { connectPostgres } from '@infrastructure/db/postgres';
import { connectRedis } from '@infrastructure/redis';
import { connectRabbitMQ } from '@infrastructure/rabbitmq';
import { config } from '@config';
import http from 'http';
import { RawLogWorker } from '@workers/raw-log.worker';
import { AggregationWorker } from '@workers/aggregation.worker';

async function bootstrap() {
  try {
    console.log('⏳ Bootstrapping PulseAPI Infrastructure...');
    
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
    
    await Promise.all([
      rawLogWorker.start(),
      aggregationWorker.start()
    ]);

    // 2. Start HTTP Server
    const app = createApp();
    const server = http.createServer(app);

    server.listen(config.PORT, () => {
      console.log(`🚀 PulseAPI running on http://localhost:${config.PORT}`);
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