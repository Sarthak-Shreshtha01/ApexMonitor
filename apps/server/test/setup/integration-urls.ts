/**
 * Connection settings for integration tests. Defaults match docker-compose.yml;
 * override with TEST_* variables (CI service containers use these).
 */
export const TEST_DB = 'apexmonitor_test';

export const testUrls = {
  pgAdmin: process.env.TEST_PG_ADMIN_URI ?? 'postgresql://pulse:pulse_dev_password@127.0.0.1:9999/postgres',
  pg: process.env.TEST_PG_URI ?? `postgresql://pulse:pulse_dev_password@127.0.0.1:9999/${TEST_DB}`,
  mongo: process.env.TEST_MONGO_URI ?? `mongodb://127.0.0.1:27018/${TEST_DB}`,
  redis: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15',
  rabbit: process.env.TEST_RABBITMQ_URL ?? `amqp://pulse:pulse_dev@127.0.0.1:5672/${TEST_DB}`,
  rabbitMgmt: process.env.TEST_RABBITMQ_MGMT_URL ?? 'http://127.0.0.1:15672',
  rabbitUser: process.env.TEST_RABBITMQ_USER ?? 'pulse',
  rabbitPass: process.env.TEST_RABBITMQ_PASS ?? 'pulse_dev',
};
