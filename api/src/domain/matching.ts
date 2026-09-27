/**
 * Pool compatibility rule (docs/architecture.md §5).
 *
 * Two bookings can share a Tesla when they start in the same pickup zone and
 * every pair of drop-offs is at most MAX_DROPOFF_SPREAD_M apart, which keeps the
 * detour for whoever is dropped off last short.
 *
 *   Nusrat -> Mohakhali, Rafiq -> Gulshan 1: Mohakhali <-> Gulshan 1 = 1.5 km  -> share
 *   Shirin -> Uttara:                        Uttara <-> Mohakhali   = 14.5 km -> doesn't
 */
export const MAX_DROPOFF_SPREAD_M = 3_000;

export interface MatchCandidate {
  pickupZoneId: number;
  dropoffZoneId: number;
}

/**
 * @param newcomer   the booking that wants to join
 * @param onBoard    bookings already in the pool
 * @param distanceM  distance lookup between two zones (0 for the same zone)
 */
export function isCompatible(
  newcomer: MatchCandidate,
  onBoard: MatchCandidate[],
  distanceM: (fromZoneId: number, toZoneId: number) => number,
): boolean {
  return onBoard.every(
    (other) =>
      other.pickupZoneId === newcomer.pickupZoneId &&
      distanceM(newcomer.dropoffZoneId, other.dropoffZoneId) <= MAX_DROPOFF_SPREAD_M,
  );
}
