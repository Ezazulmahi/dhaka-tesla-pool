// Zone ids from migrations/002_reference_zones.sql
export const ZONE = {
  BANANI: 1,
  GULSHAN_1: 2,
  GULSHAN_2: 3,
  MOHAKHALI: 4,
  BASHUNDHARA: 5,
  UTTARA: 6,
  MIRPUR: 7,
  FARMGATE: 8,
  DHANMONDI: 9,
  MOTIJHEEL: 10,
} as const;

/** Nusrat's and Rafiq's trips from the story, as request bodies. */
export const TRIPS = {
  nusrat: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.MOHAKHALI, seats: 1, paymentMethod: 'TESLAPAY' },
  rafiq: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.GULSHAN_1, seats: 1, paymentMethod: 'CASH' },
  shirin: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.GULSHAN_2, seats: 1, paymentMethod: 'CASH' },
} as const;
