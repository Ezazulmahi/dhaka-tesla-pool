import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { pool } from './db/pool';

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Dhaka Tesla Pool API listening');
});

// Graceful shutdown so docker stop doesn't cut transactions mid-flight.
function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
