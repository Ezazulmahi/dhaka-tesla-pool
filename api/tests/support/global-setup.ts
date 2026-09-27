import { loadTestEnv } from './load-env';

// Runs once before the whole suite: bring the test database schema up to date.
export default async function globalSetup() {
  loadTestEnv();
  const { migrate } = await import('../../src/db/migrate');
  const { pool } = await import('../../src/db/pool');
  await migrate();
  await pool.end();
}
