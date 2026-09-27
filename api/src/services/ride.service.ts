import { pool, withTransaction, type Db } from '../db/pool';
import { AppError, conflict, notFound } from '../lib/errors';
import { quoteFare, settleFare } from '../domain/fare';
import { assertRideTransition, CANCELLABLE_RIDE_STATUSES } from '../domain/stateMachine';
import { zoneModel } from '../models/zone.model';
import { userModel } from '../models/user.model';
import { rideRequestModel, type RideDetailRow } from '../models/rideRequest.model';
import { rideEventModel } from '../models/rideEvent.model';
import type { CreateRideInput, EstimateInput } from '../validators/ride.validators';

export async function requireDistance(db: Db, from: number, to: number) {
  const distanceM = await zoneModel.distanceM(db, from, to);
  if (distanceM === null) throw new AppError(400, 'UNKNOWN_ZONE', 'We do not serve one of these zones yet');
  return distanceM;
}

async function withCoRiders(db: Db, ride: RideDetailRow) {
  const coRiders = ride.pool_id ? await rideRequestModel.listCoRiders(db, ride.pool_id, ride.id) : [];
  return { ride, coRiders };
}

export const rideService = {
  /** Solo price (the most you will pay) and the price if the ride ends up shared. */
  async estimate(input: EstimateInput) {
    const distanceM = await requireDistance(pool, input.pickupZoneId, input.dropoffZoneId);
    const quote = quoteFare(distanceM, input.seats);
    const pooled = settleFare(quote.subtotalPaisa, true);
    return { ...quote, soloFarePaisa: quote.subtotalPaisa, pooledFarePaisa: pooled.finalFarePaisa };
  },

  async requestRide(passengerId: string, input: CreateRideInput) {
    const existing = await rideRequestModel.findActiveDetailForPassenger(pool, passengerId);
    if (existing) {
      throw conflict('ACTIVE_RIDE_EXISTS', 'You already have an active ride', { rideId: existing.id });
    }

    const rideId = await withTransaction(async (tx) => {
      const distanceM = await requireDistance(tx, input.pickupZoneId, input.dropoffZoneId);
      const quote = quoteFare(distanceM, input.seats);

      if (input.paymentMethod === 'TESLAPAY') {
        const me = await userModel.findById(tx, passengerId);
        if (!me || me.wallet_balance_paisa < quote.subtotalPaisa) {
          throw conflict('INSUFFICIENT_BALANCE', 'Not enough TeslaPay balance for this ride, choose cash', {
            requiredPaisa: quote.subtotalPaisa,
            balancePaisa: me?.wallet_balance_paisa ?? 0,
          });
        }
      }

      // The partial unique index still guards the race where two requests pass the check above.
      const ride = await rideRequestModel.create(tx, {
        passengerId,
        pickupZoneId: input.pickupZoneId,
        dropoffZoneId: input.dropoffZoneId,
        seats: input.seats,
        paymentMethod: input.paymentMethod,
        distanceM,
        estimatedFarePaisa: quote.subtotalPaisa,
      });
      await rideEventModel.record(tx, {
        rideRequestId: ride.id,
        actorId: passengerId,
        type: 'RIDE_REQUESTED',
        to: 'REQUESTED',
        details: { seats: ride.seats, estimatedFarePaisa: ride.estimated_fare_paisa },
      });
      return ride.id;
    });

    return this.getForPassenger(passengerId, rideId);
  },

  async getForPassenger(passengerId: string, rideId: string) {
    const ride = await rideRequestModel.findDetailForPassenger(pool, rideId, passengerId);
    if (!ride) throw notFound('Ride');
    return withCoRiders(pool, ride);
  },

  async currentForPassenger(passengerId: string) {
    const ride = await rideRequestModel.findActiveDetailForPassenger(pool, passengerId);
    return ride ? withCoRiders(pool, ride) : null;
  },

  historyForPassenger(passengerId: string) {
    return rideRequestModel.listDetailForPassenger(pool, passengerId);
  },

  async eventsForPassenger(passengerId: string, rideId: string) {
    await this.getForPassenger(passengerId, rideId); // ownership check
    return rideEventModel.listForRide(pool, rideId);
  },

  /** Nusrat can cancel while she is waiting or matched, but not once Bullet has started moving. */
  async cancel(passengerId: string, rideId: string, reason?: string) {
    await withTransaction(async (tx) => {
      const ride = await rideRequestModel.findById(tx, rideId, { forUpdate: true });
      if (!ride || ride.passenger_id !== passengerId) throw notFound('Ride');
      if (!CANCELLABLE_RIDE_STATUSES.includes(ride.status)) {
        assertRideTransition(ride.status, 'CANCELLED'); // throws INVALID_TRANSITION with from/to
        throw conflict('CANCEL_NOT_ALLOWED', 'This ride can no longer be cancelled');
      }
      const updated = await rideRequestModel.transition(tx, rideId, ride.status, 'CANCELLED', {
        cancel_reason: reason ?? 'Cancelled by passenger',
      });
      if (!updated) throw conflict('RIDE_CHANGED', 'This ride changed just now, please refresh');
      await rideEventModel.record(tx, {
        rideRequestId: rideId,
        actorId: passengerId,
        type: 'RIDE_CANCELLED',
        from: ride.status,
        to: 'CANCELLED',
        details: { reason: reason ?? null },
      });
    });
    return this.getForPassenger(passengerId, rideId);
  },
};
