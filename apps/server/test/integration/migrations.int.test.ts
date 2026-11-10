import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testUrls } from '../setup/integration-urls';
import { loadMigrationFiles, migrationStatus, runMigrations } from '../../src/infrastructure/db/migrations';

// Each test uses its own throwaway database next to the integration DB.
const created: string[] = [];
async function freshDatabase(tag: string): Promise<Client> {
  const name = `apexmonitor_mig_${tag}_${Date.now()}`;
  const admin = new Client({ connectionString: testUrls.pgAdmin });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  created.push(name);
  const client = new Client({ connectionString: testUrls.pg.replace(/\/[^/]+$/, `/${name}`) });
  await client.connect();
  return client;
}
const clients: Client[] = [];
const open = async (tag: string) => {
  const c = await freshDatabase(tag);
  clients.push(c);
  return c;
};

afterAll(async () => {
  await Promise.all(clients.map((c) => c.end().catch(() => undefined)));
  const admin = new Client({ connectionString: testUrls.pgAdmin });
  await admin.connect();
  for (const name of created) await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
});

const files = loadMigrationFiles();
const tables = async (db: Client) =>
  (await db.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`)).rows.map((r) => r.table_name);

describe('migration runner on real Postgres (KI-15)', () => {
  it('builds an empty database from scratch, records every file, and a second run does nothing', async () => {
    const db = await open('fresh');
    expect(await runMigrations(db)).toEqual(files.map((f) => f.name));
    expect(await tables(db)).toEqual(expect.arrayContaining(['users', 'projects', 'api_keys', 'hourly_metrics', 'alert_rules', 'billing_checkouts', 'schema_migrations']));
    expect(await runMigrations(db)).toEqual([]);
    const status = await migrationStatus(db);
    expect(status.pending).toEqual([]);
    expect(status.applied).toHaveLength(files.length);
  });

  it('adopts a database that was migrated by hand before the runner existed', async () => {
    const db = await open('legacy');
    // The old process: every SQL file applied manually, nothing recorded.
    for (const f of files) await db.query(f.sql);
    const before = await tables(db);
    expect(before).not.toContain('schema_migrations');

    expect(await runMigrations(db)).toHaveLength(files.length); // re-applies safely, then records
    expect((await tables(db)).filter((t) => t !== 'schema_migrations')).toEqual(before);
    expect((await migrationStatus(db)).pending).toEqual([]);
  });

  it('two runners at once apply each file exactly once (advisory lock)', async () => {
    const first = await open('race');
    const dbName = (await first.query<{ db: string }>('SELECT current_database() AS db')).rows[0].db;
    const second = new Client({ connectionString: testUrls.pg.replace(/\/[^/]+$/, `/${dbName}`) });
    await second.connect();
    clients.push(second);

    const [a, b] = await Promise.all([runMigrations(first), runMigrations(second)]);
    expect([...a, ...b].sort()).toEqual(files.map((f) => f.name));
    const { rows } = await first.query<{ n: string }>('SELECT count(*) AS n FROM schema_migrations');
    expect(Number(rows[0].n)).toBe(files.length);
  });

  it('a failing migration is rolled back and not recorded', async () => {
    const db = await open('broken');
    const broken = [...files, { version: String(files.length + 1).padStart(4, '0'), name: 'zz_broken.sql', sql: 'CREATE TABLE half_done (id int); SELECT * FROM missing_table;', checksum: 'x'.repeat(64) }];
    await expect(runMigrations(db, broken)).rejects.toThrow('Migration zz_broken.sql failed');
    expect(await tables(db)).not.toContain('half_done');
    expect((await migrationStatus(db, broken)).pending.map((m) => m.name)).toEqual(['zz_broken.sql']);
  });
});
