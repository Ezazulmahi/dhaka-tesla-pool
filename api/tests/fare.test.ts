import { describe, expect, it } from 'vitest';
import { poolDiscountPaisa, quoteFare, settleFare } from '../src/domain/fare';

// The worked example from docs/architecture.md §6, checked by hand:
//   Nusrat  Banani -> Mohakhali  2300 m: 3000 + 3450 = 6450, pooled -1290 = 5160 (৳51.60)
//   Rafiq   Banani -> Gulshan 1  2500 m: 3000 + 3750 = 6750, pooled -1350 = 5400 (৳54.00)
describe('fare model', () => {
  it("prices Nusrat's solo trip to Mohakhali at ৳64.50", () => {
    expect(quoteFare(2300, 1)).toEqual({
      distanceM: 2300,
      seats: 1,
      baseFarePaisa: 3000,
      distanceChargePaisa: 3450,
      subtotalPaisa: 6450,
    });
  });

  it("gives Nusrat and Rafiq their own pooled fares: ৳51.60 and ৳54.00", () => {
    const nusrat = settleFare(quoteFare(2300, 1).subtotalPaisa, true);
    const rafiq = settleFare(quoteFare(2500, 1).subtotalPaisa, true);
    expect(nusrat).toEqual({ poolDiscountPaisa: 1290, finalFarePaisa: 5160 });
    expect(rafiq).toEqual({ poolDiscountPaisa: 1350, finalFarePaisa: 5400 });
  });

  it('charges per seat: Nusrat bringing a friend pays for two seats', () => {
    expect(quoteFare(2300, 2).subtotalPaisa).toBe(12_900);
  });

  it('gives no discount when the trip was not shared', () => {
    expect(settleFare(6450, false)).toEqual({ poolDiscountPaisa: 0, finalFarePaisa: 6450 });
  });

  it('never produces fractional paisa: rounding of odd distances is deterministic', () => {
    const q = quoteFare(2333, 1); // 2333 × 1.5 = 3499.5 -> 3500
    expect(q.distanceChargePaisa).toBe(3500);
    expect(Number.isInteger(poolDiscountPaisa(6499, true))).toBe(true); // floor(1299.8) = 1299
    expect(poolDiscountPaisa(6499, true)).toBe(1299);
  });

  it('the pooled fare is never higher than the quote', () => {
    for (let d = 100; d <= 25_000; d += 700) {
      for (let seats = 1; seats <= 3; seats++) {
        const { subtotalPaisa } = quoteFare(d, seats);
        expect(settleFare(subtotalPaisa, true).finalFarePaisa).toBeLessThanOrEqual(subtotalPaisa);
      }
    }
  });

  it('rejects nonsense input', () => {
    expect(() => quoteFare(0, 1)).toThrow(RangeError);
    expect(() => quoteFare(1000, 0)).toThrow(RangeError);
    expect(() => quoteFare(10.5, 1)).toThrow(RangeError);
  });
});
