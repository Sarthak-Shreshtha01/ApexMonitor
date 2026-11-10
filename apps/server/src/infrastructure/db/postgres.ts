import { Pool } from 'pg';
import { config } from '@config';
import { migrationStatus, runMigrations } from './migrations';

let pool: Pool;

export async function connectPostgres(): Promise<void> {
  pool = new Pool({
    connectionString: config.PG_URI,
    max: 20, // Connection pool size
    idleTimeoutMillis: 30_000,
  });

  const client = await pool.connect();
  await client.query('SELECT 1'); // Ping to verify
  client.release();
  console.log('✅ [PostgreSQL] Connected');
}

export function getPg(): Pool {
  if (!pool) throw new Error('Postgres not connected');
  return pool;
}
/**
 * Brings the schema up to date before anything else touches the database.
 * With DB_AUTO_MIGRATE (default outside production) pending migrations are applied;
 * otherwise the process refuses to start and names them, so a production deploy can't run
 * new code against an old schema. Run `npm run db:migrate` (or `node dist/migrate.js`).
 */
export async function ensureSchemaUpToDate(): Promise<void> {
  const client = await getPg().connect(); // one session: the advisory lock is per connection
  try {
    const status = await migrationStatus(client);
    if (status.pending.length === 0) return;
    const names = status.pending.map((m) => m.name);
    if (!config.DB_AUTO_MIGRATE) {
      throw new Error(`Database has ${names.length} pending migration(s): ${names.join(', ')}. Run "npm run db:migrate" (or "node dist/migrate.js") first.`);
    }
    const applied = await runMigrations(client, undefined, (line) => console.log(`[migrate] ${line}`));
    console.log(`✅ [PostgreSQL] Applied ${applied.length} migration(s)`);
  } finally {
    client.release();
  }
}
