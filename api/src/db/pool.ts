import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

pool.on('error', (err) => logger.error({ err }, 'idle postgres client error'));

/** Anything that can run a query: the shared pool or a client inside a transaction. */
export type Db = Pick<PoolClient, 'query'>;

export async function queryRows<T extends QueryResultRow>(db: Db, text: string, params: unknown[] = []) {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(db: Db, text: string, params: unknown[] = []) {
  const rows = await queryRows<T>(db, text, params);
  return rows[0] ?? null;
}

// 40001 serialization_failure, 40P01 deadlock_detected: safe to retry the whole transaction.
const RETRYABLE = new Set(['40001', '40P01']);
const MAX_ATTEMPTS = 3;

/**
 * Runs `fn` inside BEGIN/COMMIT on a dedicated client. Rolls back on any error
 * and retries the whole unit of work on deadlock/serialization failures.
 */
export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const code = (err as { code?: string }).code;
      if (code && RETRYABLE.has(code) && attempt < MAX_ATTEMPTS) {
        logger.warn({ code, attempt }, 'retrying transaction');
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
