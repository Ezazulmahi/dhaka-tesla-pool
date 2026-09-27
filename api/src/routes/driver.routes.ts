import { Router } from 'express';
import { driverController } from '../controllers/driver.controller';
import { requireAuth, requireRole } from '../middlewares/auth';

// Driver-only resources: availability, the request feed, and the Tesla's trips (pools).
export const driverRoutes = Router()
  .use(requireAuth, requireRole('DRIVER'))
  .patch('/availability', driverController.setAvailability)
  .get('/requests', driverController.feed)
  .post('/requests/:id/accept', driverController.accept)
  .get('/pools/current', driverController.current)
  .get('/pools', driverController.history)
  .get('/pools/:id', driverController.show)
  .post('/pools/:id/arrive', driverController.arrive)
  .post('/pools/:id/start', driverController.start)
  .post('/pools/:id/complete', driverController.complete)
  .post('/pools/:id/cancel', driverController.cancel);
