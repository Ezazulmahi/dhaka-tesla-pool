// Import order matters: setup-env points process.env at the TEST database
// before the app's env/pool modules are evaluated.
import './setup-env';
import { migrate } from '../../src/db/migrate';
import { pool } from '../../src/db/pool';

// Runs once before the whole suite: bring the test database schema up to date.
export default async function globalSetup() {
  await migrate();
  await pool.end();
}
