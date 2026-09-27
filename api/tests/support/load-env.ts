import { existsSync } from 'node:fs';

/** Point the app at the TEST database before any app module reads process.env. */
export function loadTestEnv() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  process.env.NODE_ENV = 'test';
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required to run the tests (see .env.example)');
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ??= 'test-only-secret-at-least-16-chars';
}
