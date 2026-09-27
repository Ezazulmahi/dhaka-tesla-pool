import type { Db } from '../db/pool';

export interface RideEventInput {
  rideRequestId?: string | null;
  poolId?: string | null;
  actorId?: string | null;
  type: string;
  from?: string | null;
  to?: string | null;
  details?: Record<string, unknown>;
}

export interface RideEventRow {
  id: string;
  ride_request_id: string | null;
  pool_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  created_at: Date;
}

export const rideEventModel = {
  /** Append-only. Always written in the same transaction as the change it describes. */
  async record(db: Db, e: RideEventInput) {
    await db.query(
      `INSERT INTO ride_events (ride_request_id, pool_id, actor_id, event_type, from_status, to_status, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.rideRequestId ?? null, e.poolId ?? null, e.actorId ?? null, e.type, e.from ?? null, e.to ?? null, e.details ?? {}],
    );
  },

  async listForRide(db: Db, rideRequestId: string) {
    const { rows } = await db.query<RideEventRow>(
      `SELECT e.*, u.name AS actor_name
         FROM ride_events e
         LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.ride_request_id = $1
           OR e.pool_id = (SELECT pool_id FROM ride_requests WHERE id = $1) AND e.ride_request_id IS NULL
        ORDER BY e.created_at, e.id`,
      [rideRequestId],
    );
    return rows;
  },
};
