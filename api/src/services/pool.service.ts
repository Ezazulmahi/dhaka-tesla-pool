import type { PoolClient } from 'pg';
import type { Db } from '../db/pool';
import { isCompatible } from '../domain/matching';
import { JOINABLE_POOL_STATUSES } from '../domain/stateMachine';
import { poolModel, type PoolRow } from '../models/pool.model';
import { rideRequestModel, type RideRequestRow } from '../models/rideRequest.model';
import { rideEventModel } from '../models/rideEvent.model';
import { zoneModel } from '../models/zone.model';

export type JoinResult =
  | { joined: true; pool: PoolRow }
  | { joined: false; reason: 'CLOSED' | 'FULL' | 'INCOMPATIBLE' };

/** What happened when a passenger's request tried to join an existing Tesla. */
export type MatchOutcome = 'JOINED_POOL' | 'WAITING_FOR_DRIVER' | 'LAST_SEAT_TAKEN';

async function routeFits(tx: Db, poolId: string, ride: RideRequestRow) {
  const onBoard = await poolModel.listPassengers(tx, poolId);
  if (onBoard.length === 0) return true;
  const distance = await zoneModel.distanceLookupFrom(
    tx,
    ride.dropoff_zone_id,
    onBoard.map((p) => p.dropoff_zone_id),
  );
  return isCompatible(
    { pickupZoneId: ride.pickup_zone_id, dropoffZoneId: ride.dropoff_zone_id },
    onBoard.map((p) => ({ pickupZoneId: ride.pickup_zone_id, dropoffZoneId: p.dropoff_zone_id })),
    distance,
  );
}

export const poolService = {
  /**
   * Try to put `ride` into pool `poolId`. The single place where seats are allocated.
   *
   * 1. Lock the pool row (SELECT ... FOR UPDATE). A concurrent joiner waits here, then
   *    re-reads the committed seats_taken. This is what settles Nusrat vs Shirin.
   * 2. Re-check status, zone, free seats and route compatibility *under the lock*.
   * 3. Claim seats with a conditional UPDATE (belt) backed by the CHECK constraint (braces).
   *
   * Must run inside a transaction. Caller must not hold a lock on any *other* ride
   * in this pool (lock order: pool -> rides).
   */
  async tryJoin(
    tx: PoolClient,
    poolId: string,
    ride: RideRequestRow,
    ctx: { actorId: string; via: 'AUTO_MATCH' | 'DRIVER_ACCEPT' },
  ): Promise<JoinResult> {
    const p = await poolModel.findById(tx, poolId, { forUpdate: true });
    if (!p || !JOINABLE_POOL_STATUSES.includes(p.status) || p.pickup_zone_id !== ride.pickup_zone_id) {
      return { joined: false, reason: 'CLOSED' };
    }
    if (p.capacity - p.seats_taken < ride.seats) return { joined: false, reason: 'FULL' };
    if (!(await routeFits(tx, p.id, ride))) return { joined: false, reason: 'INCOMPATIBLE' };

    const claimed = await poolModel.claimSeats(tx, p.id, ride.seats);
    if (!claimed) return { joined: false, reason: 'FULL' };

    const matched = await rideRequestModel.transition(tx, ride.id, 'REQUESTED', 'MATCHED', { pool_id: p.id });
    if (!matched) throw new Error(`ride ${ride.id} left REQUESTED while locked`); // caller holds the ride lock
    await rideEventModel.record(tx, {
      rideRequestId: ride.id,
      poolId: p.id,
      actorId: ctx.actorId,
      type: 'RIDE_MATCHED',
      from: 'REQUESTED',
      to: 'MATCHED',
      details: { via: ctx.via, seatsTaken: claimed.seats_taken, capacity: claimed.capacity },
    });
    return { joined: true, pool: claimed };
  },

  /**
   * Called right after a passenger requests: join the oldest compatible Tesla
   * already heading to (or waiting at) their pickup zone.
   */
  async autoMatch(tx: PoolClient, ride: RideRequestRow): Promise<MatchOutcome> {
    const candidates = await poolModel.listJoinableInZone(tx, ride.pickup_zone_id, ride.seats);
    let lostARace = false;

    for (const candidate of candidates) {
      const result = await this.tryJoin(tx, candidate.id, ride, { actorId: ride.passenger_id, via: 'AUTO_MATCH' });
      if (result.joined) return 'JOINED_POOL';
      // It had room when we listed it, but not once we held the lock: someone got there first.
      if (result.reason === 'FULL') lostARace = true;
    }

    if (lostARace) {
      await rideEventModel.record(tx, {
        rideRequestId: ride.id,
        actorId: ride.passenger_id,
        type: 'AUTO_MATCH_LOST_RACE',
        details: { message: 'The last seat was taken a moment earlier; waiting for another Tesla' },
      });
      return 'LAST_SEAT_TAKEN';
    }
    return 'WAITING_FOR_DRIVER';
  },

  /** For the driver's feed: can this waiting ride join the pool Jashim already has? */
  async fitsPool(tx: Db, p: PoolRow, ride: RideRequestRow) {
    return p.capacity - p.seats_taken >= ride.seats && (await routeFits(tx, p.id, ride));
  },
};
