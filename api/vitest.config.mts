import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests hit a real Postgres (constraints, row locks and concurrency can't be
    // faked), so files share one database and must run one at a time.
    fileParallelism: false,
    globalSetup: ['tests/support/global-setup.ts'],
    setupFiles: ['tests/support/setup-env.ts', 'tests/support/setup-db.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
