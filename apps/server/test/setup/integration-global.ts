import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { TEST_DB, testUrls } from './integration-urls';

const MIGRATIONS = ['init-postgres.sql', 'migrate-v2.sql', 'migrate-v3.sql', 'migrate-v4.sql', 'migrate-v4-rum.sql', 'migrate-v5.sql'];
const scriptsDir = path.resolve(__dirname, '../../../../scripts');

function hint(service: string, error: unknown): Error {
  return new Error(
    `Integration tests could not reach ${service}: ${(error as Error).message}\n` +
      'Start the local stack with `docker compose up -d` (repo root) or set TEST_* URLs.',
  );
}

async function resetPostgres() {
  const admin = new Client({ connectionString: testUrls.pgAdmin });
  try {
    await admin.connect();
  } catch (e) {
    throw hint('PostgreSQL', e);
  }
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TEST_DB]);
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const db = new Client({ connectionString: testUrls.pg });
  await db.connect();
  for (const file of MIGRATIONS) {
    await db.query(fs.readFileSync(path.join(scriptsDir, file), 'utf8'));
  }
  await db.end();
}

async function resetMongo() {
  try {
    const conn = await mongoose.createConnection(testUrls.mongo, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await conn.dropDatabase();
    await conn.close();
  } catch (e) {
    throw hint('MongoDB', e);
  }
}

async function resetRedis() {
  const redis = new Redis(testUrls.redis, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.flushdb();
  } catch (e) {
    throw hint('Redis', e);
  } finally {
    redis.disconnect();
  }
}

async function resetRabbitVhost() {
  const auth = `Basic ${Buffer.from(`${testUrls.rabbitUser}:${testUrls.rabbitPass}`).toString('base64')}`;
  const vhost = encodeURIComponent(TEST_DB);
  const api = (p: string, init: RequestInit = {}) =>
    fetch(`${testUrls.rabbitMgmt}/api${p}`, { ...init, headers: { authorization: auth, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  try {
    await api(`/vhosts/${vhost}`, { method: 'DELETE' });
    const created = await api(`/vhosts/${vhost}`, { method: 'PUT' });
    if (!created.ok) throw new Error(`create vhost: HTTP ${created.status}`);
    const perms = await api(`/permissions/${vhost}/${encodeURIComponent(testUrls.rabbitUser)}`, {
      method: 'PUT',
      body: JSON.stringify({ configure: '.*', write: '.*', read: '.*' }),
    });
    if (!perms.ok) throw new Error(`set permissions: HTTP ${perms.status}`);
  } catch (e) {
    throw hint('RabbitMQ management API', e);
  }
}

export default async function setup() {
  await Promise.all([resetPostgres(), resetMongo(), resetRedis(), resetRabbitVhost()]);
}
