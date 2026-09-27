import type { Request, Response } from 'express';
import { driverService } from '../services/driver.service';
import { availabilitySchema, cancelPoolSchema } from '../validators/driver.validators';
import { idParamSchema } from '../validators/ride.validators';
import { driverPoolView, driverRequestView } from '../views/pool.view';
import { vehicleView } from '../views/user.view';

type PoolResult = Awaited<ReturnType<typeof driverService.poolForDriver>>;
const render = ({ pool, passengers }: PoolResult) => driverPoolView(pool, passengers);

export const driverController = {
  async setAvailability(req: Request, res: Response) {
    const vehicle = await driverService.setAvailability(req.user!.id, availabilitySchema.parse(req.body));
    req.log.info({ online: vehicle.is_online, zoneId: vehicle.current_zone_id }, 'driver availability changed');
    res.json({ vehicle: vehicleView(vehicle) });
  },

  async feed(req: Request, res: Response) {
    const { online, requests } = await driverService.feed(req.user!.id);
    res.json({ online, requests: requests.map(driverRequestView) });
  },

  async accept(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const result = await driverService.accept(req.user!.id, id);
    req.log.info({ rideId: id, poolId: result.pool.id }, 'driver accepted ride');
    res.json({ pool: render(result) });
  },

  async current(req: Request, res: Response) {
    const result = await driverService.currentPool(req.user!.id);
    res.json({ pool: result ? render(result) : null });
  },

  async history(req: Request, res: Response) {
    const results = await driverService.history(req.user!.id);
    res.json({ pools: results.map(render) });
  },

  async show(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ pool: render(await driverService.poolForDriver(req.user!.id, id)) });
  },

  async arrive(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ pool: render(await driverService.arrive(req.user!.id, id)) });
  },

  async start(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ pool: render(await driverService.start(req.user!.id, id)) });
  },

  async complete(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const result = await driverService.complete(req.user!.id, id);
    req.log.info({ poolId: id }, 'trip completed');
    res.json({ pool: render(result) });
  },

  async cancel(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = cancelPoolSchema.parse(req.body ?? {});
    res.json({ pool: render(await driverService.cancel(req.user!.id, id, reason)) });
  },
};
