import { Router } from 'express';
import { pool } from '../db/pool';
import { zoneModel } from '../models/zone.model';
import { authRoutes } from './auth.routes';
import { rideRoutes } from './ride.routes';

export const apiRoutes = Router()
  .use('/auth', authRoutes)
  // Public reference data: the zones we serve.
  .get('/zones', async (_req, res) => {
    const zones = await zoneModel.list(pool);
    res.json({ zones: zones.map((z) => ({ id: z.id, code: z.code, name: z.name, lat: Number(z.lat), lng: Number(z.lng) })) });
  })
  .use('/rides', rideRoutes);
