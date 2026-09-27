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

  /**
   * Distances from one zone to several others, as a lookup function for the
   * matching rule. Same zone = 0; an unknown pair counts as infinitely far.
   */
  async distanceLookupFrom(db: Db, fromZoneId: number, toZoneIds: number[]) {
    const rows = await queryRows<{ to_zone_id: number; distance_m: number }>(
      db,
      'SELECT to_zone_id, distance_m FROM zone_distances WHERE from_zone_id = $1 AND to_zone_id = ANY($2::smallint[])',
      [fromZoneId, toZoneIds],
    );
    const byZone = new Map(rows.map((r) => [r.to_zone_id, r.distance_m]));
    return (from: number, to: number) => {
      if (from === to) return 0;
      const other = from === fromZoneId ? to : from;
      return byZone.get(other) ?? Number.POSITIVE_INFINITY;
    };
  },
};
