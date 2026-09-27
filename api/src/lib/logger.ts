import pino from 'pino';
import { env } from '../config/env';

// Structured JSON logs: one line per event, easy to grep locally and to ship
// to a log service later.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
});
