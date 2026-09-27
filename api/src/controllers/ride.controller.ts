import type { Request, Response } from 'express';
import { rideService } from '../services/ride.service';
import { cancelRideSchema, createRideSchema, estimateSchema, idParamSchema } from '../validators/ride.validators';
import { passengerRideView, rideEventView } from '../views/ride.view';

export const rideController = {
  async estimate(req: Request, res: Response) {
    res.json({ estimate: await rideService.estimate(estimateSchema.parse(req.body)) });
  },

  async create(req: Request, res: Response) {
    const { ride, coRiders, matchOutcome } = await rideService.requestRide(
      req.user!.id,
      createRideSchema.parse(req.body),
    );
    req.log.info({ rideId: ride.id, poolId: ride.pool_id, matchOutcome }, 'ride requested');
    res.status(201).json({ ride: passengerRideView(ride, coRiders), matchOutcome });
  },

  async current(req: Request, res: Response) {
    const current = await rideService.currentForPassenger(req.user!.id);
    res.json({ ride: current ? passengerRideView(current.ride, current.coRiders) : null });
  },

  async history(req: Request, res: Response) {
    const rides = await rideService.historyForPassenger(req.user!.id);
    res.json({ rides: rides.map((r) => passengerRideView(r)) });
  },

  async show(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { ride, coRiders } = await rideService.getForPassenger(req.user!.id, id);
    res.json({ ride: passengerRideView(ride, coRiders) });
  },

  async events(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const events = await rideService.eventsForPassenger(req.user!.id, id);
    res.json({ events: events.map(rideEventView) });
  },

  async cancel(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = cancelRideSchema.parse(req.body ?? {});
    const { ride, coRiders } = await rideService.cancel(req.user!.id, id, reason);
    req.log.info({ rideId: id }, 'ride cancelled by passenger');
    res.json({ ride: passengerRideView(ride, coRiders) });
  },
};
