import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = path.join(rootDir, 'scripts');

const expectedFiles = ['init-postgres.sql', 'migrate-v2.sql', 'migrate-v3.sql', 'migrate-v4.sql', 'migrate-v4-rum.sql', 'migrate-v5.sql', 'migrate-v6.sql', 'migrate-v7.sql'];

for (const fileName of expectedFiles) {
  const filePath = path.join(scriptsDir, fileName);
  await readFile(filePath, 'utf8');
}

const initSql = await readFile(path.join(scriptsDir, 'init-postgres.sql'), 'utf8');

const requiredSnippets = [
  "plan           VARCHAR(32)  NOT NULL DEFAULT 'free'",
  'log_retention_days INTEGER  NOT NULL DEFAULT 90',
  'CREATE TABLE IF NOT EXISTS audit_logs',
  'idx_api_keys_lookup',
  'idx_rum_keys_lookup',
];

for (const snippet of requiredSnippets) {
  if (!initSql.includes(snippet)) {
    throw new Error(`Migration validation failed: missing snippet ${snippet}`);
  }
}

// Tables that depend on `users` (created in migrate-v2) live in later migrations, not the init script.
const v5Sql = await readFile(path.join(scriptsDir, 'migrate-v5.sql'), 'utf8');
if (!v5Sql.includes('CREATE TABLE IF NOT EXISTS billing_checkouts')) {
  throw new Error('Migration validation failed: migrate-v5.sql must create billing_checkouts');
}

const v7Sql = await readFile(path.join(scriptsDir, 'migrate-v7.sql'), 'utf8');
for (const fn of ['apex_hist_add', 'apex_hist_sum', 'apex_hist_percentile']) {
  if (!v7Sql.includes(fn)) throw new Error(`Migration validation failed: migrate-v7.sql must define ${fn}`);
}

console.log('Migration validation passed.');