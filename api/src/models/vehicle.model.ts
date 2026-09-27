import { type Db, queryOne } from '../db/pool';

export interface VehicleRow {
  id: string;
  driver_id: string;
  name: string;
  plate: string;
  capacity: number;
  is_online: boolean;
  current_zone_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export const vehicleModel = {
  findByDriver(db: Db, driverId: string, opts: { forUpdate?: boolean } = {}) {
    return queryOne<VehicleRow>(
      db,
      `SELECT * FROM vehicles WHERE driver_id = $1 ${opts.forUpdate ? 'FOR UPDATE' : ''}`,
      [driverId],
    );
  },

  setAvailability(db: Db, id: string, isOnline: boolean, zoneId: number | null) {
    return queryOne<VehicleRow>(
      db,
      `UPDATE vehicles SET is_online = $2, current_zone_id = COALESCE($3, current_zone_id), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, isOnline, zoneId],
    ) as Promise<VehicleRow>;
  },
};
