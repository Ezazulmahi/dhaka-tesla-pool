import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^01[3-9]\d{8}$/, 'Use an 11-digit Bangladeshi mobile number, e.g. 01811000001');

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1).max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
