import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { eventBus } from '@events/event-bus';

const serverRoot = path.resolve(__dirname, '../../..');
const tsx = path.resolve(serverRoot, '../../node_modules/.bin/tsx');

const validEnv = {
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://h:1/db',
  PG_URI: 'postgresql://u:p@h:1/db',
  REDIS_URL: 'redis://h:1',
  RABBITMQ_URL: 'amqp://u:p@h:1',
  JWT_SECRET: 'x'.repeat(32),
  ARGON2_PEPPER: 'y'.repeat(32),
  CORS_ORIGINS: 'http://a,http://b',
};

function loadConfig(env: Record<string, string>) {
  const script = "const { config } = require('./src/config/config.ts'); console.log(JSON.stringify(config));";
  return spawnSync(tsx, ['-e', script], { cwd: serverRoot, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8', timeout: 30_000 });
}

describe('config loading', () => {
  it('parses a valid environment without any .env file and applies defaults', () => {
    const r = loadConfig(validEnv);
    expect(r.status).toBe(0);
    const config = JSON.parse(r.stdout.trim().split('\n').pop()!);
    expect(config).toMatchObject({ PORT: 3000, RATE_LIMIT_RPM: 60000, LOG_LEVEL: 'info', CORS_ORIGINS: ['http://a', 'http://b'] });
  });

  it('exits 1 listing missing variables', () => {
    const r = loadConfig({ NODE_ENV: 'test' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Invalid environment variables');
    expect(r.stderr).toContain('MONGO_URI');
  });

  it.each([
    ['JWT_SECRET shorter than 32 chars', { JWT_SECRET: 'short' }],
    ['JWT_REFRESH_SECRET shorter than 32 chars', { JWT_REFRESH_SECRET: 'short' }],
    ['ARGON2_PEPPER shorter than 32 chars', { ARGON2_PEPPER: 'short' }],
    ['non-URL PG_URI', { PG_URI: 'not a url' }],
    ['unknown LOG_LEVEL', { LOG_LEVEL: 'trace' }],
    ['non-numeric PORT', { PORT: 'abc' }],
  ])('exits 1 for %s', (_l, override) => {
    expect(loadConfig({ ...validEnv, ...override }).status).toBe(1);
  });
});

describe('event bus', () => {
  it('delivers typed payloads to listeners', () => {
    const seen: unknown[] = [];
    const listener = (p: unknown) => seen.push(p);
    eventBus.on('alert.triggered', listener);
    eventBus.emit('alert.triggered', { alertRuleId: 1, projectId: 'p', message: 'm', severity: 'critical' });
    eventBus.off('alert.triggered', listener);
    eventBus.emit('alert.triggered', { alertRuleId: 2, projectId: 'p', message: 'm', severity: 'info' });
    expect(seen).toEqual([{ alertRuleId: 1, projectId: 'p', message: 'm', severity: 'critical' }]);
  });
});
