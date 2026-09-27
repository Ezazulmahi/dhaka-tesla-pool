import { z } from 'zod';

/** Every Tesla in the fleet is a three-seater, so a single booking can take at most 3 seats. */
export const MAX_SEATS_PER_REQUEST = 3;

const zoneId = z.coerce.number().int().positive();

const trip = z
  .object({
    pickupZoneId: zoneId,
    dropoffZoneId: zoneId,
    seats: z.coerce.number().int().min(1).max(MAX_SEATS_PER_REQUEST).default(1),
  })
  .refine((t) => t.pickupZoneId !== t.dropoffZoneId, {
    message: 'Pickup and destination must be different zones',
    path: ['dropoffZoneId'],
  });

export const estimateSchema = trip;

export const createRideSchema = trip.and(
  z.object({ paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH') }),
);

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const idParamSchema = z.object({ id: z.uuid('Not a valid id') });

export type EstimateInput = z.infer<typeof estimateSchema>;
export type CreateRideInput = z.infer<typeof createRideSchema>;
