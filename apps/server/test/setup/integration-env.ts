import { testUrls } from './integration-urls';

// Real services, isolated test databases. Runs before any app module is imported.
process.env.NODE_ENV = 'test';
// Run in a non-UTC, non-whole-hour zone so timezone bugs show up the same way locally and in CI.
process.env.TZ = 'Asia/Kolkata';
process.env.LOG_LEVEL = 'error';
process.env.MONGO_URI = testUrls.mongo;
process.env.PG_URI = testUrls.pg;
process.env.REDIS_URL = testUrls.redis;
process.env.RABBITMQ_URL = testUrls.rabbit;
process.env.JWT_SECRET = 'integration-access-secret-0123456789abcdef';
process.env.ARGON2_PEPPER = 'integration-pepper-0123456789abcdefghijk';
process.env.CORS_ORIGINS = 'http://localhost:3001';
process.env.FRONTEND_URL = 'http://localhost:3001';
// PhonePe's public sandbox test credentials, set explicitly (the server has no built-in defaults).
process.env.PHONEPE_ENV = 'sandbox';
process.env.PHONEPE_MERCHANT_ID = 'PGTESTPAYUAT';
process.env.PHONEPE_SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
process.env.PHONEPE_SALT_INDEX = '1';

if (!process.env.DEBUG_TESTS) {
  console.log = () => undefined;
  console.error = () => undefined;
  console.warn = () => undefined;
}
