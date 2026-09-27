import { describe, expect, it } from 'vitest';
import { isCompatible, MAX_DROPOFF_SPREAD_M } from '../src/domain/matching';
import { ZONE } from './support/zones';

// A tiny slice of the zone_distances table (metres), enough for the story.
const TABLE: Record<string, number> = {
  [`${ZONE.MOHAKHALI}-${ZONE.GULSHAN_1}`]: 1500,
  [`${ZONE.MOHAKHALI}-${ZONE.GULSHAN_2}`]: 2700,
  [`${ZONE.GULSHAN_1}-${ZONE.GULSHAN_2}`]: 2100,
  [`${ZONE.MOHAKHALI}-${ZONE.UTTARA}`]: 14500,
  [`${ZONE.GULSHAN_1}-${ZONE.UTTARA}`]: 14600,
};
const distance = (a: number, b: number) =>
  a === b ? 0 : (TABLE[`${a}-${b}`] ?? TABLE[`${b}-${a}`] ?? Number.POSITIVE_INFINITY);

const nusrat = { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.MOHAKHALI };
const rafiq = { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.GULSHAN_1 };

describe('pool compatibility rule', () => {
  it('uses a 3 km drop-off spread', () => {
    expect(MAX_DROPOFF_SPREAD_M).toBe(3000);
  });

  it("lets Rafiq (-> Gulshan 1) share with Nusrat (-> Mohakhali): overlapping but not identical", () => {
    expect(isCompatible(rafiq, [nusrat], distance)).toBe(true);
  });

  it('lets anyone into an empty Tesla', () => {
    expect(isCompatible(rafiq, [], distance)).toBe(true);
  });

  it('keeps Shirin (-> Uttara) out of a Mohakhali/Gulshan trip', () => {
    const shirin = { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.UTTARA };
    expect(isCompatible(shirin, [nusrat, rafiq], distance)).toBe(false);
  });

  it('checks against EVERY passenger, not just one', () => {
    // Gulshan 2 is 2.1 km from Gulshan 1 but 2.7 km from Mohakhali: fine for both.
    const shirin = { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.GULSHAN_2 };
    expect(isCompatible(shirin, [nusrat, rafiq], distance)).toBe(true);
  });

  it('never mixes pickup zones', () => {
    const fromGulshan = { pickupZoneId: ZONE.GULSHAN_1, dropoffZoneId: ZONE.MOHAKHALI };
    expect(isCompatible(fromGulshan, [nusrat], distance)).toBe(false);
  });
});
