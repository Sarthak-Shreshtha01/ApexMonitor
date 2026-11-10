/**
 * Database migration CLI.
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- status  list applied / pending / modified
 * In the Docker image: node dist/migrate.js [status]
 * Uses PG_URI from the environment (or the repo-root .env in development).
 */
import { Client } from 'pg';
import { config } from '@config';
import { migrationStatus, runMigrations } from '@infrastructure/db/migrations';

async function main(): Promise<void> {
  const client = new Client({ connectionString: config.PG_URI });
  await client.connect();
  try {
    if (process.argv.includes('status')) {
      const status = await migrationStatus(client);
      for (const m of status.applied) console.log(`applied   ${m.name}`);
      for (const m of status.pending) console.log(`pending   ${m.name}`);
      for (const m of status.modified) console.log(`MODIFIED  ${m.name} (changed after it was applied)`);
      process.exitCode = status.pending.length > 0 ? 2 : 0;
      return;
    }
    const applied = await runMigrations(client, undefined, (line) => console.log(line));
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : 'Database is up to date.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
});
