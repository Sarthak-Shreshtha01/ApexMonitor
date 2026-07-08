import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = path.join(rootDir, 'scripts');

const expectedFiles = ['init-postgres.sql', 'migrate-v2.sql', 'migrate-v3.sql', 'migrate-v4.sql', 'migrate-v4-rum.sql'];

for (const fileName of expectedFiles) {
  const filePath = path.join(scriptsDir, fileName);
  await readFile(filePath, 'utf8');
}

const initSql = await readFile(path.join(scriptsDir, 'init-postgres.sql'), 'utf8');

const requiredSnippets = [
  "plan           VARCHAR(32)  NOT NULL DEFAULT 'free'",
  'log_retention_days INTEGER  NOT NULL DEFAULT 90',
  'CREATE TABLE IF NOT EXISTS audit_logs',
];

for (const snippet of requiredSnippets) {
  if (!initSql.includes(snippet)) {
    throw new Error(`Migration validation failed: missing snippet ${snippet}`);
  }
}

console.log('Migration validation passed.');