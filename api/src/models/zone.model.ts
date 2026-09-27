import { type Db, queryOne, queryRows } from '../db/pool';

export interface ZoneRow {
  id: number;
  code: string;
  name: string;
  lat: string; // numeric comes back as string from pg
  lng: string;
}

export const zoneModel = {
  list(db: Db) {
    return queryRows<ZoneRow>(db, 'SELECT * FROM zones ORDER BY name');
  },

  findById(db: Db, id: number) {
    return queryOne<ZoneRow>(db, 'SELECT * FROM zones WHERE id = $1', [id]);
  },

  async distanceM(db: Db, fromZoneId: number, toZoneId: number): Promise<number | null> {
    const row = await queryOne<{ distance_m: number }>(
      db,
      'SELECT distance_m FROM zone_distances WHERE from_zone_id = $1 AND to_zone_id = $2',
      [fromZoneId, toZoneId],
    );
    return row?.distance_m ?? null;
  },
};
