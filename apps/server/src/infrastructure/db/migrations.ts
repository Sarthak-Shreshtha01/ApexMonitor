import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Postgres schema migrations.
 *
 * Files live in `<repo>/scripts/migrations/NNNN_name.sql` and are applied in order. Each one
 * runs in its own transaction and is recorded in `schema_migrations` with a checksum. An
 * advisory lock makes concurrent runners (several API replicas booting at once) wait for
 * each other instead of applying the same file twice.
 *
 * Rules for migration files: never edit one that has been applied anywhere, add a new file
 * instead; keep statements re-runnable (IF NOT EXISTS, guarded DO blocks), so databases
 * that were migrated by hand before this runner existed can adopt it safely.
 *
 * This module only needs `pg`, so test setup and the CLI can use it without app config.
 */

export interface MigrationFile {
  version: string; // "0007"
  name: string; // "0007_key_lookup.sql"
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

export interface MigrationStatus {
  applied: AppliedMigration[];
  pending: MigrationFile[];
  /** Applied files whose content changed afterwards. */
  modified: Array<{ name: string; recorded: string; current: string }>;
}

/** Anything with pg's `query` (a Client or a PoolClient). */
export interface Queryable {
  query<R = any>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;
// Arbitrary constant; identifies "ApexMonitor schema migrations" among advisory locks.
const LOCK_ID = 727_271_001;

/**
 * Finds `scripts/migrations` by walking up to the folder that holds package-lock.json
 * (works from src/, from the bundled dist/, and inside the Docker image).
 * MIGRATIONS_DIR overrides it.
 */
export function defaultMigrationsDir(from = __dirname): string {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  let dir = from;
  for (let depth = 0; depth < 8; depth++) {
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return path.join(dir, 'scripts', 'migrations');
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find scripts/migrations; set MIGRATIONS_DIR');
}

export function loadMigrationFiles(dir = defaultMigrationsDir()): MigrationFile[] {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const seen = new Set<string>();
  return files.map((name) => {
    const match = FILE_PATTERN.exec(name);
    if (!match) throw new Error(`Migration file name must look like 0001_snake_case.sql: ${name}`);
    if (seen.has(match[1])) throw new Error(`Duplicate migration version ${match[1]}`);
    seen.add(match[1]);
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    return { version: match[1], name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  });
}

async function ensureTable(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(16)  PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      checksum   CHAR(64)     NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
}

export async function migrationStatus(db: Queryable, files = loadMigrationFiles()): Promise<MigrationStatus> {
  await ensureTable(db);
  const { rows } = await db.query<AppliedMigration>(`SELECT version, name, checksum FROM schema_migrations ORDER BY version`);
  const applied = new Map(rows.map((r) => [r.version, r]));
  return {
    applied: rows,
    pending: files.filter((f) => !applied.has(f.version)),
    modified: files
      .filter((f) => applied.has(f.version) && applied.get(f.version)!.checksum.trim() !== f.checksum)
      .map((f) => ({ name: f.name, recorded: applied.get(f.version)!.checksum.trim(), current: f.checksum })),
  };
}

/**
 * Applies all pending migrations in order, each in its own transaction. Returns the names
 * applied. Stops at the first failure (that file is rolled back; earlier ones stay).
 */
export async function runMigrations(db: Queryable, files = loadMigrationFiles(), log: (line: string) => void = () => undefined): Promise<string[]> {
  await db.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
  try {
    const status = await migrationStatus(db, files); // re-read under the lock
    for (const m of status.modified) {
      log(`⚠️  ${m.name} changed after it was applied (recorded ${m.recorded.slice(0, 12)}…, now ${m.current.slice(0, 12)}…). Add a new migration instead of editing applied ones.`);
    }
    const applied: string[] = [];
    for (const file of status.pending) {
      log(`→ applying ${file.name}`);
      await db.query('BEGIN');
      try {
        await db.query(file.sql);
        await db.query(`INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`, [file.version, file.name, file.checksum]);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${file.name} failed: ${(error as Error).message}`);
      }
      applied.push(file.name);
    }
    return applied;
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
  }
}
