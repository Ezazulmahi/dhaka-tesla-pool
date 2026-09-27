import { z } from 'zod';

export const availabilitySchema = z.object({
  online: z.boolean(),
  zoneId: z.coerce.number().int().positive().optional(),
});

export const cancelPoolSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});
