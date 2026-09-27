import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pool } from './pool';
import { logger } from '../lib/logger';

// Tiny forward-only migration runner: applies migrations/NNN_name.sql in order,
// each in its own transaction, and records it in schema_migrations.
// An advisory lock stops two containers from migrating at the same time.
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const LOCK_ID = 73_142_024;

export async function migrate(): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const done = new Set(
      (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.info({ file }, 'migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then((applied) => {
      logger.info({ count: applied.length }, 'migrations complete');
      return pool.end();
    })
    .catch((err) => {
      logger.error({ err }, 'migration failed');
      process.exit(1);
    });
}
