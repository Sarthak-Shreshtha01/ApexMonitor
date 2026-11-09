import { defineConfig } from 'vitest/config';
import { serverAliases } from './vitest.config';

/**
 * Integration tests: run the real API, workers and websocket server in-process against
 * real PostgreSQL, MongoDB, Redis and RabbitMQ (docker compose locally, service
 * containers in CI). Each run uses isolated databases / vhost, never the dev data.
 */
export default defineConfig({
  resolve: { alias: serverAliases },
  test: {
    name: 'server-integration',
    environment: 'node',
    include: ['test/integration/**/*.int.test.ts'],
    globalSetup: ['test/setup/integration-global.ts'],
    setupFiles: ['test/setup/integration-env.ts'],
    // One process, shared module state: the stack is started once for all files.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    teardownTimeout: 10_000,
  },
});
