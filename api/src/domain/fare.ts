/**
 * Fare model. Pure functions, no I/O, so it can be checked by hand and unit-tested.
 * All amounts are integer paisa (৳1 = 100 paisa); floats never touch money.
 *
 *   subtotal     = (BASE + round(distance_m × PER_KM / 1000)) × seats
 *   poolDiscount = floor(subtotal × 20 / 100)   if the trip was shared
 *   fare         = subtotal − poolDiscount
 */
export const FARE = {
  BASE_PAISA: 3_000, // ৳30 flag-fall per seat
  PER_KM_PAISA: 1_500, // ৳15 per km per seat
  POOL_DISCOUNT_PERCENT: 20,
} as const;

export interface FareQuote {
  distanceM: number;
  seats: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
}

export function quoteFare(distanceM: number, seats: number): FareQuote {
  if (!Number.isInteger(distanceM) || distanceM <= 0) throw new RangeError('distanceM must be a positive integer');
  if (!Number.isInteger(seats) || seats <= 0) throw new RangeError('seats must be a positive integer');

  const distanceChargePaisa = Math.round((distanceM * FARE.PER_KM_PAISA) / 1000);
  return {
    distanceM,
    seats,
    baseFarePaisa: FARE.BASE_PAISA,
    distanceChargePaisa,
    subtotalPaisa: (FARE.BASE_PAISA + distanceChargePaisa) * seats,
  };
}

export function poolDiscountPaisa(subtotalPaisa: number, shared: boolean): number {
  return shared ? Math.floor((subtotalPaisa * FARE.POOL_DISCOUNT_PERCENT) / 100) : 0;
}

/** Final fare once we know whether the trip was actually shared. Never above the quote. */
export function settleFare(subtotalPaisa: number, shared: boolean) {
  const discount = poolDiscountPaisa(subtotalPaisa, shared);
  return { poolDiscountPaisa: discount, finalFarePaisa: subtotalPaisa - discount };
}
