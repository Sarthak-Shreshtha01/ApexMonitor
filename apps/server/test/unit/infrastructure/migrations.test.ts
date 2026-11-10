import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultMigrationsDir, loadMigrationFiles, migrationStatus, Queryable, runMigrations } from '@infrastructure/db/migrations';

const dirs: string[] = [];
function tmpDir(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-mig-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Records statements; `applied` plays the schema_migrations table; `failOn` makes a statement throw. */
function fakeDb(applied: Array<{ version: string; name: string; checksum: string }> = [], failOn?: string) {
  const log: string[] = [];
  const db: Queryable = {
    async query(text: string, params?: unknown[]) {
      log.push(text.trim().split('\n')[0]);
      if (failOn && text.includes(failOn)) throw new Error('syntax error');
      if (text.startsWith('SELECT version, name, checksum')) return { rows: [...applied] as any };
      if (text.startsWith('INSERT INTO schema_migrations')) applied.push({ version: String(params![0]), name: String(params![1]), checksum: String(params![2]) });
      return { rows: [] };
    },
  };
  return { db, log, applied };
}

describe('loadMigrationFiles (KI-15)', () => {
  it('loads NNNN_name.sql files in order with checksums', () => {
    const files = loadMigrationFiles(tmpDir({ '0002_b.sql': 'SELECT 2;', '0001_a.sql': 'SELECT 1;', 'README.md': 'ignored' }));
    expect(files.map((f) => [f.version, f.name])).toEqual([['0001', '0001_a.sql'], ['0002', '0002_b.sql']]);
    expect(files[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects badly named and duplicate-version files', () => {
    expect(() => loadMigrationFiles(tmpDir({ 'add-users.sql': '' }))).toThrow('0001_snake_case.sql');
    expect(() => loadMigrationFiles(tmpDir({ '0001_a.sql': '', '0001_b.sql': '' }))).toThrow('Duplicate migration version 0001');
  });

  it('finds the repository migrations and they are all valid', () => {
    const files = loadMigrationFiles(defaultMigrationsDir());
    expect(files[0].name).toBe('0001_initial_schema.sql');
    expect(files.map((f) => f.version)).toEqual(files.map((_, i) => String(i + 1).padStart(4, '0')));
  });
});

describe('runMigrations (KI-15)', () => {
  const files = () => loadMigrationFiles(tmpDir({ '0001_a.sql': 'CREATE TABLE a();', '0002_b.sql': 'CREATE TABLE b();' }));

  it('applies pending files in order, each in its own transaction, under an advisory lock', async () => {
    const { db, log, applied } = fakeDb();
    expect(await runMigrations(db, files())).toEqual(['0001_a.sql', '0002_b.sql']);
    expect(applied.map((a) => a.version)).toEqual(['0001', '0002']);
    const flow = log.filter((l) => /advisory|BEGIN|COMMIT|CREATE TABLE a|CREATE TABLE b/.test(l));
    expect(flow).toEqual([
      'SELECT pg_advisory_lock($1)',
      'BEGIN', 'CREATE TABLE a();', 'COMMIT',
      'BEGIN', 'CREATE TABLE b();', 'COMMIT',
      'SELECT pg_advisory_unlock($1)',
    ]);
  });

  it('skips files that are already recorded', async () => {
    const all = files();
    const { db, log } = fakeDb([{ version: '0001', name: '0001_a.sql', checksum: all[0].checksum }]);
    expect(await runMigrations(db, all)).toEqual(['0002_b.sql']);
    expect(log).not.toContain('CREATE TABLE a();');
  });

  it('rolls back a failing file, keeps earlier ones, releases the lock and says which file failed', async () => {
    const { db, log, applied } = fakeDb([], 'CREATE TABLE b');
    await expect(runMigrations(db, files())).rejects.toThrow('Migration 0002_b.sql failed: syntax error');
    expect(applied.map((a) => a.version)).toEqual(['0001']);
    expect(log).toContain('ROLLBACK');
    expect(log.at(-1)).toBe('SELECT pg_advisory_unlock($1)');
  });

  it('warns about applied files whose content changed', async () => {
    const all = files();
    const { db } = fakeDb([{ version: '0001', name: '0001_a.sql', checksum: 'f'.repeat(64) }]);
    const lines: string[] = [];
    await runMigrations(db, all, (l) => lines.push(l));
    expect(lines[0]).toContain('0001_a.sql changed after it was applied');
    expect((await migrationStatus(db, all)).modified.map((m) => m.name)).toEqual(['0001_a.sql']);
  });
});
