import { type Db, queryOne, queryRows } from '../db/pool';
import type { PoolStatus, RideStatus } from '../domain/stateMachine';

export type PaymentMethod = 'CASH' | 'TESLAPAY';

export interface RideRequestRow {
  id: string;
  passenger_id: string;
  pool_id: string | null;
  pickup_zone_id: number;
  dropoff_zone_id: number;
  seats: number;
  status: RideStatus;
  payment_method: PaymentMethod;
  distance_m: number;
  estimated_fare_paisa: number;
  pool_discount_paisa: number | null;
  final_fare_paisa: number | null;
  cancel_reason: string | null;
  created_at: Date;
  matched_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  updated_at: Date;
}

/** A ride joined with the names a screen needs (zones, driver, Tesla, pool state). */
export interface RideDetailRow extends RideRequestRow {
  passenger_name: string;
  pickup_zone_name: string;
  dropoff_zone_name: string;
  pool_status: PoolStatus | null;
  pool_capacity: number | null;
  pool_seats_taken: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
}

export interface CoRiderRow {
  ride_id: string;
  passenger_name: string;
  dropoff_zone_name: string;
  seats: number;
  status: RideStatus;
}

const DETAIL_SELECT = `
  SELECT r.*,
         pu.name  AS passenger_name,
         pz.name  AS pickup_zone_name,
         dz.name  AS dropoff_zone_name,
         p.status AS pool_status, p.capacity AS pool_capacity, p.seats_taken AS pool_seats_taken,
         d.name   AS driver_name, d.phone AS driver_phone,
         v.name   AS vehicle_name, v.plate AS vehicle_plate
    FROM ride_requests r
    JOIN users pu ON pu.id = r.passenger_id
    JOIN zones pz ON pz.id = r.pickup_zone_id
    JOIN zones dz ON dz.id = r.dropoff_zone_id
    LEFT JOIN pools p    ON p.id = r.pool_id
    LEFT JOIN users d    ON d.id = p.driver_id
    LEFT JOIN vehicles v ON v.id = p.vehicle_id`;

export const rideRequestModel = {
  create(
    db: Db,
    r: {
      passengerId: string;
      pickupZoneId: number;
      dropoffZoneId: number;
      seats: number;
      paymentMethod: PaymentMethod;
      distanceM: number;
      estimatedFarePaisa: number;
    },
  ) {
    return queryOne<RideRequestRow>(
      db,
      `INSERT INTO ride_requests
         (passenger_id, pickup_zone_id, dropoff_zone_id, seats, payment_method, distance_m, estimated_fare_paisa)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [r.passengerId, r.pickupZoneId, r.dropoffZoneId, r.seats, r.paymentMethod, r.distanceM, r.estimatedFarePaisa],
    ) as Promise<RideRequestRow>;
  },

  findById(db: Db, id: string, opts: { forUpdate?: boolean } = {}) {
    return queryOne<RideRequestRow>(
      db,
      `SELECT * FROM ride_requests WHERE id = $1 ${opts.forUpdate ? 'FOR UPDATE' : ''}`,
      [id],
    );
  },

  /** Ownership lives in the WHERE clause: Rafiq asking for Nusrat's ride gets nothing. */
  findDetailForPassenger(db: Db, id: string, passengerId: string) {
    return queryOne<RideDetailRow>(db, `${DETAIL_SELECT} WHERE r.id = $1 AND r.passenger_id = $2`, [id, passengerId]);
  },

  findDetailById(db: Db, id: string) {
    return queryOne<RideDetailRow>(db, `${DETAIL_SELECT} WHERE r.id = $1`, [id]);
  },

  findActiveDetailForPassenger(db: Db, passengerId: string) {
    return queryOne<RideDetailRow>(
      db,
      `${DETAIL_SELECT} WHERE r.passenger_id = $1 AND r.status IN ('REQUESTED', 'MATCHED', 'IN_PROGRESS')`,
      [passengerId],
    );
  },

  listDetailForPassenger(db: Db, passengerId: string, limit = 50) {
    return queryRows<RideDetailRow>(
      db,
      `${DETAIL_SELECT} WHERE r.passenger_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
      [passengerId, limit],
    );
  },

  /** Other passengers sharing the same Tesla. Only what a co-rider may see: first name, stop, seats. */
  listCoRiders(db: Db, poolId: string, excludeRideId: string) {
    return queryRows<CoRiderRow>(
      db,
      `SELECT r.id AS ride_id, u.name AS passenger_name, dz.name AS dropoff_zone_name, r.seats, r.status
         FROM ride_requests r
         JOIN users u  ON u.id = r.passenger_id
         JOIN zones dz ON dz.id = r.dropoff_zone_id
        WHERE r.pool_id = $1 AND r.id <> $2 AND r.status IN ('MATCHED', 'IN_PROGRESS', 'COMPLETED')
        ORDER BY r.matched_at`,
      [poolId, excludeRideId],
    );
  },

  /**
   * Guarded status change: only succeeds if the row is still in `from`.
   * Returns null if someone else changed it first; the caller turns that into a 409.
   */
  transition(
    db: Db,
    id: string,
    from: RideStatus,
    to: RideStatus,
    set: Partial<{
      pool_id: string | null;
      cancel_reason: string | null;
      pool_discount_paisa: number;
      final_fare_paisa: number;
    }> = {},
  ) {
    const timestampColumn: Partial<Record<RideStatus, string>> = {
      MATCHED: 'matched_at',
      IN_PROGRESS: 'started_at',
      COMPLETED: 'completed_at',
      CANCELLED: 'cancelled_at',
    };
    const assignments = ['status = $3', 'updated_at = now()'];
    const params: unknown[] = [id, from, to];
    // Column names come from the typed `set` keys above, never from user input.
    for (const [col, value] of Object.entries(set)) {
      params.push(value);
      assignments.push(`${col} = $${params.length}`);
    }
    const ts = timestampColumn[to];
    if (ts) assignments.push(`${ts} = now()`);
    if (to === 'REQUESTED') assignments.push('matched_at = NULL');

    return queryOne<RideRequestRow>(
      db,
      `UPDATE ride_requests SET ${assignments.join(', ')} WHERE id = $1 AND status = $2 RETURNING *`,
      params,
    );
  },
};
