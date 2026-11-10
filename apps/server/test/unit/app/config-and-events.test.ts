import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
    ['non-numeric RUM_RATE_LIMIT_RPM', { RUM_RATE_LIMIT_RPM: 'lots' }],
    ['PhonePe merchant without salt', { PHONEPE_MERCHANT_ID: 'M1' }],
    ['PhonePe salt without merchant', { PHONEPE_SALT_KEY: 'salt' }],
    ['unknown PHONEPE_ENV', { PHONEPE_ENV: 'staging', PHONEPE_MERCHANT_ID: 'M1', PHONEPE_SALT_KEY: 's' }],
    ['production billing against the sandbox endpoint', { NODE_ENV: 'production', PHONEPE_MERCHANT_ID: 'M1', PHONEPE_SALT_KEY: 's' }],
    ['production with the public sandbox merchant', { NODE_ENV: 'production', PHONEPE_ENV: 'production', PHONEPE_MERCHANT_ID: 'PGTESTPAYUAT', PHONEPE_SALT_KEY: 's' }],
  ])('exits 1 for %s', (_l, override) => {
    expect(loadConfig({ ...validEnv, ...override }).status).toBe(1);
  });

  it('accepts production without billing, and production with real PhonePe settings (KI-7)', () => {
    const off = loadConfig({ ...validEnv, NODE_ENV: 'production' });
    expect(off.status).toBe(0);
    expect(JSON.parse(off.stdout.trim().split('\n').pop()!)).not.toHaveProperty('PHONEPE_MERCHANT_ID');
    const live = loadConfig({ ...validEnv, NODE_ENV: 'production', PHONEPE_ENV: 'production', PHONEPE_MERCHANT_ID: 'M_LIVE', PHONEPE_SALT_KEY: 'k', PHONEPE_SALT_INDEX: '3' });
    expect(live.status).toBe(0);
    expect(JSON.parse(live.stdout.trim().split('\n').pop()!)).toMatchObject({ PHONEPE_ENV: 'production', PHONEPE_SALT_INDEX: 3 });
  });

  it('DB_AUTO_MIGRATE defaults to on outside production and off in production (KI-15)', () => {
    const last = (env: Record<string, string>) => JSON.parse(loadConfig(env).stdout.trim().split('\n').pop()!).DB_AUTO_MIGRATE;
    expect(last(validEnv)).toBe(true);
    expect(last({ ...validEnv, NODE_ENV: 'production' })).toBe(false);
    expect(last({ ...validEnv, NODE_ENV: 'production', DB_AUTO_MIGRATE: 'true' })).toBe(true);
    expect(loadConfig({ ...validEnv, DB_AUTO_MIGRATE: 'yes' }).status).toBe(1);
  });

  it('parses RUM_RATE_LIMIT_RPM as a number (KI-14)', () => {
    const r = loadConfig({ ...validEnv, RUM_RATE_LIMIT_RPM: '5000' });
    expect(JSON.parse(r.stdout.trim().split('\n').pop()!).RUM_RATE_LIMIT_RPM).toBe(5000);
  });

  it('loads the file named by ENV_FILE outside tests; variables already set still win', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-env-'));
    const file = path.join(dir, 'custom.env');
    const { NODE_ENV: _n, ...rest } = validEnv;
    fs.writeFileSync(file, Object.entries({ ...rest, PORT: '4321', LOG_LEVEL: 'warn' }).map(([k, v]) => `${k}=${v}`).join('\n'));
    try {
      const r = loadConfig({ NODE_ENV: 'development', ENV_FILE: file, LOG_LEVEL: 'error' });
      expect(r.status).toBe(0);
      const config = JSON.parse(r.stdout.trim().split('\n').pop()!);
      expect(config).toMatchObject({ PORT: 4321, LOG_LEVEL: 'error', MONGO_URI: validEnv.MONGO_URI });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never reads ENV_FILE when NODE_ENV=test', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-env-'));
    const file = path.join(dir, 'custom.env');
    fs.writeFileSync(file, 'PORT=4321');
    try {
      const r = loadConfig({ ...validEnv, ENV_FILE: file });
      expect(JSON.parse(r.stdout.trim().split('\n').pop()!).PORT).toBe(3000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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
