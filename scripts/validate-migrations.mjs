// CI sanity check for scripts/migrations (the runner is apps/server/src/infrastructure/db/migrations.ts).
// - file names are NNNN_snake_case.sql, numbered 0001, 0002, ... without gaps or duplicates
// - a few objects the app depends on are created somewhere
// - no statement that would fail when a file is re-applied to a hand-migrated database
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const fail = (msg) => {
  throw new Error(`Migration validation failed: ${msg}`);
};

if (files.length === 0) fail('no migrations found');
files.forEach((name, i) => {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
  if (!match) fail(`bad file name ${name} (expected NNNN_snake_case.sql)`);
  const expected = String(i + 1).padStart(4, '0');
  if (match[1] !== expected) fail(`expected version ${expected} but found ${name} (no gaps or duplicates)`);
});

const all = (await Promise.all(files.map((f) => readFile(path.join(dir, f), 'utf8')))).join('\n');
for (const snippet of [
  'CREATE TABLE IF NOT EXISTS projects',
  'CREATE TABLE IF NOT EXISTS users',
  'CREATE TABLE IF NOT EXISTS audit_logs',
  'CREATE TABLE IF NOT EXISTS billing_checkouts',
  'idx_api_keys_lookup',
  'apex_hist_percentile',
  'project_members_role_check',
]) {
  if (!all.includes(snippet)) fail(`no migration contains "${snippet}"`);
}

// Plain "ADD CONSTRAINT" / "CREATE TABLE x" without IF NOT EXISTS breaks re-application.
for (const name of files) {
  const sql = await readFile(path.join(dir, name), 'utf8');
  const unguardedTable = /CREATE TABLE (?!IF NOT EXISTS)/i.test(sql);
  const unguardedIndex = /CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i.test(sql);
  const unguardedConstraint = /ADD CONSTRAINT/i.test(sql) && !/IF NOT EXISTS \(SELECT 1 FROM pg_constraint/i.test(sql);
  if (unguardedTable || unguardedIndex || unguardedConstraint) fail(`${name} has a statement that fails when re-applied (use IF NOT EXISTS / a guarded DO block)`);
}

console.log(`Migration validation passed (${files.length} files).`);
