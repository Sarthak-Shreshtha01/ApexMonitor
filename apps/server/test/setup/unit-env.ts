// Deterministic environment for unit tests. Runs before any test module is imported,
// so `@config` validates against these values and never reads a local .env file.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unit';
process.env.PG_URI = 'postgresql://unit:unit@127.0.0.1:1/unit';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.RABBITMQ_URL = 'amqp://unit:unit@127.0.0.1:1';
process.env.JWT_SECRET = 'unit-test-access-secret-0123456789abcdef';
process.env.ARGON2_PEPPER = 'unit-test-pepper-0123456789abcdefghijkl';
process.env.CORS_ORIGINS = 'http://localhost:3001';
process.env.FRONTEND_URL = 'http://localhost:3001';
// PhonePe's public sandbox test credentials, set explicitly (the server has no built-in defaults).
process.env.PHONEPE_ENV = 'sandbox';
process.env.PHONEPE_MERCHANT_ID = 'PGTESTPAYUAT';
process.env.PHONEPE_SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
process.env.PHONEPE_SALT_INDEX = '1';
delete process.env.JWT_REFRESH_SECRET;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_REDIRECT_URI;
delete process.env.GITHUB_CLIENT_ID;
delete process.env.GITHUB_CLIENT_SECRET;
delete process.env.GITHUB_REDIRECT_URI;

// Unit tests must never reach the network (OAuth providers, PhonePe, webhooks).
// Tests that exercise outbound HTTP stub fetch explicitly with vi.stubGlobal.
globalThis.fetch = (async (input: unknown) => {
  throw new Error(`Network access is disabled in unit tests (attempted: ${String(input)})`);
}) as typeof fetch;

// The server logs handled errors with console.error/console.log; keep test output readable.
// Set DEBUG_TESTS=1 to see them.
if (!process.env.DEBUG_TESTS) {
  console.error = () => undefined;
  console.log = () => undefined;
  console.warn = () => undefined;
}
