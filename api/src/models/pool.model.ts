import { type Db, queryOne, queryRows } from '../db/pool';
import type { PoolStatus } from '../domain/stateMachine';

export interface PoolRow {
  id: string;
  vehicle_id: string;
  driver_id: string;
  pickup_zone_id: number;
  status: PoolStatus;
  capacity: number;
  seats_taken: number;
  created_at: Date;
  arrived_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  updated_at: Date;
}

export interface PoolDetailRow extends PoolRow {
  pickup_zone_name: string;
  vehicle_name: string;
  vehicle_plate: string;
}

/** A passenger as the DRIVER sees them: name, phone, stop, seats, fare to collect. */
export interface PoolPassengerRow {
  ride_id: string;
  passenger_name: string;
  passenger_phone: string;
  dropoff_zone_id: number;
  dropoff_zone_name: string;
  seats: number;
  status: string;
  payment_method: string;
  distance_m: number;
  estimated_fare_paisa: number;
  pool_discount_paisa: number | null;
  final_fare_paisa: number | null;
}

const DETAIL_SELECT = `
  SELECT p.*, z.name AS pickup_zone_name, v.name AS vehicle_name, v.plate AS vehicle_plate
    FROM pools p
    JOIN zones z    ON z.id = p.pickup_zone_id
    JOIN vehicles v ON v.id = p.vehicle_id`;

const TIMESTAMP_FOR: Partial<Record<PoolStatus, string>> = {
  DRIVER_ARRIVED: 'arrived_at',
  STARTED: 'started_at',
  COMPLETED: 'completed_at',
  CANCELLED: 'cancelled_at',
};

export const poolModel = {
  create(db: Db, p: { vehicleId: string; driverId: string; pickupZoneId: number; capacity: number }) {
    return queryOne<PoolRow>(
      db,
      `INSERT INTO pools (vehicle_id, driver_id, pickup_zone_id, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [p.vehicleId, p.driverId, p.pickupZoneId, p.capacity],
    ) as Promise<PoolRow>;
  },

  /** FOR UPDATE makes this row the lock for everything that happens to the trip. */
  findById(db: Db, id: string, opts: { forUpdate?: boolean } = {}) {
    return queryOne<PoolRow>(db, `SELECT * FROM pools WHERE id = $1 ${opts.forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  },

  findActiveByDriver(db: Db, driverId: string, opts: { forUpdate?: boolean } = {}) {
    return queryOne<PoolRow>(
      db,
      `SELECT * FROM pools
        WHERE driver_id = $1 AND status IN ('OPEN', 'DRIVER_ARRIVED', 'STARTED')
        ${opts.forUpdate ? 'FOR UPDATE' : ''}`,
      [driverId],
    );
  },

  findDetail(db: Db, id: string) {
    return queryOne<PoolDetailRow>(db, `${DETAIL_SELECT} WHERE p.id = $1`, [id]);
  },

  listDetailByDriver(db: Db, driverId: string, limit = 50) {
    return queryRows<PoolDetailRow>(
      db,
      `${DETAIL_SELECT} WHERE p.driver_id = $1 ORDER BY p.created_at DESC LIMIT $2`,
      [driverId, limit],
    );
  },

  /** Joinable pools in a pickup zone, oldest first (fill the Tesla that has waited longest). */
  listJoinableInZone(db: Db, zoneId: number, minFreeSeats: number) {
    return queryRows<PoolRow>(
      db,
      `SELECT * FROM pools
        WHERE pickup_zone_id = $1
          AND status IN ('OPEN', 'DRIVER_ARRIVED')
          AND capacity - seats_taken >= $2
        ORDER BY created_at`,
      [zoneId, minFreeSeats],
    );
  },

  listPassengers(db: Db, poolId: string, opts: { includeCancelled?: boolean } = {}) {
    return queryRows<PoolPassengerRow>(
      db,
      `SELECT r.id AS ride_id, u.name AS passenger_name, u.phone AS passenger_phone,
              r.dropoff_zone_id, dz.name AS dropoff_zone_name, r.seats, r.status, r.payment_method,
              r.distance_m, r.estimated_fare_paisa, r.pool_discount_paisa, r.final_fare_paisa
         FROM ride_requests r
         JOIN users u  ON u.id = r.passenger_id
         JOIN zones dz ON dz.id = r.dropoff_zone_id
        WHERE r.pool_id = $1 ${opts.includeCancelled ? '' : "AND r.status <> 'CANCELLED'"}
        ORDER BY r.matched_at, r.created_at`,
      [poolId],
    );
  },

  /**
   * Atomic seat claim. The WHERE clause re-checks capacity at write time, so even
   * two transactions that both *read* "1 seat left" cannot both succeed.
   * Returns null when the seats are gone or the pool is no longer joinable.
   */
  claimSeats(db: Db, poolId: string, seats: number) {
    return queryOne<PoolRow>(
      db,
      `UPDATE pools SET seats_taken = seats_taken + $2, updated_at = now()
        WHERE id = $1
          AND status IN ('OPEN', 'DRIVER_ARRIVED')
          AND seats_taken + $2 <= capacity
        RETURNING *`,
      [poolId, seats],
    );
  },

  releaseSeats(db: Db, poolId: string, seats: number) {
    return queryOne<PoolRow>(
      db,
      `UPDATE pools SET seats_taken = seats_taken - $2, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [poolId, seats],
    ) as Promise<PoolRow>;
  },

  /** Guarded status change; null if the pool was no longer in `from`. */
  transition(db: Db, id: string, from: PoolStatus, to: PoolStatus) {
    const ts = TIMESTAMP_FOR[to];
    return queryOne<PoolRow>(
      db,
      `UPDATE pools SET status = $3, updated_at = now() ${ts ? `, ${ts} = now()` : ''}
        WHERE id = $1 AND status = $2 RETURNING *`,
      [id, from, to],
    );
  },
};
