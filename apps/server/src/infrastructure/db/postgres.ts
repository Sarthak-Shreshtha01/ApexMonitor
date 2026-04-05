import { Pool } from 'pg';
import { config } from '@config';

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