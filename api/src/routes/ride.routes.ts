import { Router } from 'express';
import { rideController } from '../controllers/ride.controller';
import { requireAuth, requireRole } from '../middlewares/auth';

// Passenger-only resource: a passenger's own ride requests.
export const rideRoutes = Router()
  .use(requireAuth, requireRole('PASSENGER'))
  .post('/estimate', rideController.estimate)
  .post('/', rideController.create)
  .get('/current', rideController.current)
  .get('/', rideController.history)
  .get('/:id', rideController.show)
  .get('/:id/events', rideController.events)
  .post('/:id/cancel', rideController.cancel);
