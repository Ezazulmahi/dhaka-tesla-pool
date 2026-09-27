import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { AppError, conflict, notFound } from '../lib/errors';
import { settleFare } from '../domain/fare';
import { assertPoolTransition, assertRideTransition, type PoolStatus } from '../domain/stateMachine';
import { vehicleModel, type VehicleRow } from '../models/vehicle.model';
import { poolModel, type PoolRow } from '../models/pool.model';
import { rideRequestModel } from '../models/rideRequest.model';
import { rideEventModel } from '../models/rideEvent.model';
import { userModel } from '../models/user.model';
import { zoneModel } from '../models/zone.model';

/*
 * Lock order (prevents deadlocks): vehicle -> pool -> ride requests (by id).
 * Every transaction that touches more than one of these takes locks in this order.
 */

async function requireVehicle(tx: PoolClient, driverId: string): Promise<VehicleRow> {
  const vehicle = await vehicleModel.findByDriver(tx, driverId, { forUpdate: true });
  if (!vehicle) throw new AppError(403, 'NO_VEHICLE', 'No Tesla is registered to this driver');
  return vehicle;
}

/** Lock the driver's own pool. Someone else's pool is reported as not found. */
async function requireOwnPool(tx: PoolClient, driverId: string, poolId: string): Promise<PoolRow> {
  const p = await poolModel.findById(tx, poolId, { forUpdate: true });
  if (!p || p.driver_id !== driverId) throw notFound('Trip');
  return p;
}

async function movePool(tx: PoolClient, p: PoolRow, to: PoolStatus, actorId: string, details = {}) {
  assertPoolTransition(p.status, to);
  const updated = await poolModel.transition(tx, p.id, p.status, to);
  if (!updated) throw conflict('TRIP_CHANGED', 'This trip changed just now, please refresh');
  await rideEventModel.record(tx, {
    poolId: p.id,
    actorId,
    type: `POOL_${to}`,
    from: p.status,
    to,
    details,
  });
  return updated;
}

export const driverService = {
  async setAvailability(driverId: string, input: { online: boolean; zoneId?: number }) {
    return withTransaction(async (tx) => {
      const vehicle = await requireVehicle(tx, driverId);
      const active = await poolModel.findActiveByDriver(tx, driverId);

      if (!input.online) {
        if (active) throw conflict('ACTIVE_TRIP', 'Finish or cancel your current trip before going offline');
        return vehicleModel.setAvailability(tx, vehicle.id, false, null);
      }

      const zoneId = input.zoneId ?? vehicle.current_zone_id;
      if (!zoneId) throw new AppError(400, 'VALIDATION_ERROR', 'Choose the zone you are waiting in');
      if (!(await zoneModel.findById(tx, zoneId))) throw new AppError(400, 'UNKNOWN_ZONE', 'Unknown zone');
      if (active && zoneId !== active.pickup_zone_id) {
        throw conflict('ACTIVE_TRIP', 'You cannot change zone during a trip');
      }
      return vehicleModel.setAvailability(tx, vehicle.id, true, zoneId);
    });
  },

  /** Waiting ride requests Jashim could take right now. */
  async feed(driverId: string) {
    const vehicle = await vehicleModel.findByDriver(pool, driverId);
    if (!vehicle) throw new AppError(403, 'NO_VEHICLE', 'No Tesla is registered to this driver');
    if (!vehicle.is_online || !vehicle.current_zone_id) return { online: false, requests: [] };

    const active = await poolModel.findActiveByDriver(pool, driverId);
    if (active?.status === 'STARTED') return { online: true, requests: [] };

    const freeSeats = active ? active.capacity - active.seats_taken : vehicle.capacity;
    if (freeSeats === 0) return { online: true, requests: [] };

    const requests = await rideRequestModel.listWaitingInZone(pool, vehicle.current_zone_id, freeSeats);
    return { online: true, requests };
  },

  /** Accept a waiting ride: start a new pool, or add it to the one Jashim already has open. */
  async accept(driverId: string, rideId: string) {
    const poolId = await withTransaction(async (tx) => {
      const vehicle = await requireVehicle(tx, driverId);
      if (!vehicle.is_online) throw conflict('DRIVER_OFFLINE', 'Go online before accepting rides');

      let current = await poolModel.findActiveByDriver(tx, driverId, { forUpdate: true });
      if (current?.status === 'STARTED') throw conflict('TRIP_IN_PROGRESS', 'Finish your current trip first');

      const ride = await rideRequestModel.findById(tx, rideId, { forUpdate: true });
      if (!ride) throw notFound('Ride');
      if (ride.status !== 'REQUESTED') {
        throw conflict('RIDE_ALREADY_TAKEN', 'This ride was just taken or cancelled');
      }
      if (ride.pickup_zone_id !== vehicle.current_zone_id) {
        throw conflict('OUT_OF_ZONE', 'This pickup is outside your zone');
      }

      if (!current) {
        current = await poolModel.create(tx, {
          vehicleId: vehicle.id,
          driverId,
          pickupZoneId: ride.pickup_zone_id,
          capacity: vehicle.capacity,
        });
        await rideEventModel.record(tx, {
          poolId: current.id,
          actorId: driverId,
          type: 'POOL_CREATED',
          to: 'OPEN',
          details: { vehicle: vehicle.name, capacity: vehicle.capacity },
        });
      }

      const claimed = await poolModel.claimSeats(tx, current.id, ride.seats);
      if (!claimed) throw conflict('SEAT_UNAVAILABLE', `Not enough free seats in ${vehicle.name}`);

      assertRideTransition(ride.status, 'MATCHED');
      await rideRequestModel.transition(tx, ride.id, 'REQUESTED', 'MATCHED', { pool_id: current.id });
      await rideEventModel.record(tx, {
        rideRequestId: ride.id,
        poolId: current.id,
        actorId: driverId,
        type: 'RIDE_MATCHED',
        from: 'REQUESTED',
        to: 'MATCHED',
        details: { via: 'DRIVER_ACCEPT', seatsTaken: claimed.seats_taken, capacity: claimed.capacity },
      });
      return current.id;
    });
    return this.poolForDriver(driverId, poolId);
  },

  async arrive(driverId: string, poolId: string) {
    await withTransaction(async (tx) => {
      const p = await requireOwnPool(tx, driverId, poolId);
      await movePool(tx, p, 'DRIVER_ARRIVED', driverId);
    });
    return this.poolForDriver(driverId, poolId);
  },

  /** Doors close: no one else can join, and nobody can cancel any more. */
  async start(driverId: string, poolId: string) {
    await withTransaction(async (tx) => {
      const p = await requireOwnPool(tx, driverId, poolId);
      assertPoolTransition(p.status, 'STARTED');
      if (p.seats_taken === 0) throw conflict('EMPTY_TRIP', 'There is nobody on board to start a trip for');

      await movePool(tx, p, 'STARTED', driverId);
      for (const ride of await rideRequestModel.lockByPool(tx, p.id, ['MATCHED'])) {
        await rideRequestModel.transition(tx, ride.id, 'MATCHED', 'IN_PROGRESS');
        await rideEventModel.record(tx, {
          rideRequestId: ride.id,
          poolId: p.id,
          actorId: driverId,
          type: 'RIDE_STARTED',
          from: 'MATCHED',
          to: 'IN_PROGRESS',
        });
      }
    });
    return this.poolForDriver(driverId, poolId);
  },

  /** Drop everyone off, lock in each passenger's final fare, take TeslaPay payments. */
  async complete(driverId: string, poolId: string) {
    await withTransaction(async (tx) => {
      const p = await requireOwnPool(tx, driverId, poolId);
      assertPoolTransition(p.status, 'COMPLETED');

      const riders = await rideRequestModel.lockByPool(tx, p.id, ['IN_PROGRESS']);
      // Shared = at least two separate bookings were in the car. Nusrat + a friend on one booking is not pooling.
      const shared = riders.length >= 2;

      await movePool(tx, p, 'COMPLETED', driverId, { passengers: riders.length, shared });
      for (const ride of riders) {
        const fare = settleFare(ride.estimated_fare_paisa, shared);
        await rideRequestModel.transition(tx, ride.id, 'IN_PROGRESS', 'COMPLETED', {
          pool_discount_paisa: fare.poolDiscountPaisa,
          final_fare_paisa: fare.finalFarePaisa,
        });
        await rideEventModel.record(tx, {
          rideRequestId: ride.id,
          poolId: p.id,
          actorId: driverId,
          type: 'RIDE_COMPLETED',
          from: 'IN_PROGRESS',
          to: 'COMPLETED',
          details: { shared, subtotalPaisa: ride.estimated_fare_paisa, ...fare },
        });

        if (ride.payment_method === 'TESLAPAY') {
          // Final fare <= estimate, which was balance-checked at request time, so this succeeds
          // in practice. If it ever didn't, the trip still completes and cash is collected.
          const debited = await userModel.debitWalletIfSufficient(tx, ride.passenger_id, fare.finalFarePaisa);
          await rideEventModel.record(tx, {
            rideRequestId: ride.id,
            actorId: driverId,
            type: debited ? 'PAYMENT_CAPTURED' : 'PAYMENT_FAILED_COLLECT_CASH',
            details: { method: 'TESLAPAY', amountPaisa: fare.finalFarePaisa },
          });
        }
      }
    });
    return this.poolForDriver(driverId, poolId);
  },

  /** Jashim can't make it: waiting passengers go back into the queue for another Tesla. */
  async cancel(driverId: string, poolId: string, reason?: string) {
    await withTransaction(async (tx) => {
      const p = await requireOwnPool(tx, driverId, poolId);
      assertPoolTransition(p.status, 'CANCELLED');

      for (const ride of await rideRequestModel.lockByPool(tx, p.id, ['MATCHED'])) {
        await rideRequestModel.transition(tx, ride.id, 'MATCHED', 'REQUESTED', { pool_id: null });
        await poolModel.releaseSeats(tx, p.id, ride.seats);
        await rideEventModel.record(tx, {
          rideRequestId: ride.id,
          poolId: p.id,
          actorId: driverId,
          type: 'RIDE_REQUEUED',
          from: 'MATCHED',
          to: 'REQUESTED',
          details: { reason: reason ?? 'Driver cancelled the trip' },
        });
      }
      await movePool(tx, p, 'CANCELLED', driverId, { reason: reason ?? null });
    });
    return this.poolForDriver(driverId, poolId);
  },

  async poolForDriver(driverId: string, poolId: string) {
    const detail = await poolModel.findDetail(pool, poolId);
    if (!detail || detail.driver_id !== driverId) throw notFound('Trip');
    const passengers = await poolModel.listPassengers(pool, poolId, {
      includeCancelled: detail.status === 'COMPLETED' || detail.status === 'CANCELLED',
    });
    return { pool: detail, passengers };
  },

  async currentPool(driverId: string) {
    const active = await poolModel.findActiveByDriver(pool, driverId);
    return active ? this.poolForDriver(driverId, active.id) : null;
  },

  async history(driverId: string) {
    const pools = await poolModel.listDetailByDriver(pool, driverId, 20);
    return Promise.all(
      pools.map(async (p) => ({ pool: p, passengers: await poolModel.listPassengers(pool, p.id, { includeCancelled: true }) })),
    );
  },
};
