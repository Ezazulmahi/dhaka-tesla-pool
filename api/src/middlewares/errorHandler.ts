import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from '../lib/errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

// Postgres constraint names -> friendly business errors. If application checks
// were ever bypassed, the database constraint still produces a clean 409.
const CONSTRAINT_ERRORS: Record<string, { code: string; message: string }> = {
  pools_seats_within_capacity: { code: 'SEAT_UNAVAILABLE', message: 'Not enough free seats in this Tesla' },
  ride_requests_one_active_per_passenger: { code: 'ACTIVE_RIDE_EXISTS', message: 'You already have an active ride' },
  pools_one_active_per_vehicle: { code: 'ACTIVE_POOL_EXISTS', message: 'This Tesla already has an active trip' },
  users_phone_key: { code: 'PHONE_TAKEN', message: 'An account with this phone number already exists' },
  users_wallet_balance_paisa_check: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough TeslaPay balance' },
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: z.flattenError(err).fieldErrors },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' } });
    return;
  }
  const mapped = err?.constraint ? CONSTRAINT_ERRORS[err.constraint as string] : undefined;
  if (mapped) {
    req.log?.warn({ constraint: err.constraint }, 'constraint violation mapped to 409');
    res.status(409).json({ error: mapped });
    return;
  }

  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
};
