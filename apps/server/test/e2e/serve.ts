/**
 * Starts the real API (with its workers and websockets) for the browser tests in
 * apps/web/e2e. Every start resets its own stores, isolated from dev data and from the
 * integration tests: Postgres/Mongo database and RabbitMQ vhost `apexmonitor_e2e`, Redis DB 14.
 * Playwright runs this through `npm run e2e:api --workspace=apps/server`.
 */
process.env.TEST_DB_NAME ??= 'apexmonitor_e2e';
process.env.TEST_REDIS_URL ??= 'redis://127.0.0.1:6379/14';

async function main() {
  const { testUrls } = await import('../setup/integration-urls');
  const { default: resetStores } = await import('../setup/integration-global');
  await resetStores();

  const webOrigin = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3101';
  Object.assign(process.env, {
    NODE_ENV: 'test', // ignore the developer's .env
    PORT: process.env.E2E_API_PORT ?? '3100',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
    MONGO_URI: testUrls.mongo,
    PG_URI: testUrls.pg,
    REDIS_URL: testUrls.redis,
    RABBITMQ_URL: testUrls.rabbit,
    JWT_SECRET: 'e2e-access-secret-0123456789abcdefghij',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdefghi',
    ARGON2_PEPPER: 'e2e-pepper-0123456789abcdefghijklmnopq',
    CORS_ORIGINS: webOrigin,
    FRONTEND_URL: webOrigin,
  });
  await import('../../src/bootstrap');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
