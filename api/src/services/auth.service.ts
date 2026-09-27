import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { hashPassword, hashPasswordSync, verifyPassword } from '../lib/password';
import { userModel, type UserRole, type UserRow } from '../models/user.model';
import { vehicleModel } from '../models/vehicle.model';
import type { LoginInput, SignupInput } from '../validators/auth.validators';

export interface SessionClaims {
  sub: string;
  role: UserRole;
}

// Compared against when the phone is unknown, so "no such user" and
// "wrong password" take the same time and return the same error.
const DUMMY_HASH = hashPasswordSync('timing-equaliser-not-a-real-password');

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Phone number or password is incorrect');

export const authService = {
  /** Public sign-up creates passengers only; drivers are onboarded by the operator (seed). */
  async signup(input: SignupInput): Promise<UserRow> {
    const passwordHash = await hashPassword(input.password);
    return userModel.create(pool, { name: input.name, phone: input.phone, passwordHash, role: 'PASSENGER' });
  },

  async login(input: LoginInput): Promise<UserRow> {
    const user = await userModel.findByPhone(pool, input.phone);
    const ok = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw invalidCredentials();
    return user;
  },

  async me(userId: string) {
    const user = await userModel.findById(pool, userId);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Session is no longer valid');
    const vehicle = user.role === 'DRIVER' ? await vehicleModel.findByDriver(pool, user.id) : null;
    return { user, vehicle };
  },

  issueToken(user: Pick<UserRow, 'id' | 'role'>): string {
    const claims: SessionClaims = { sub: user.id, role: user.role };
    return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  },

  verifyToken(token: string): SessionClaims {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as SessionClaims;
      if (!payload.sub || (payload.role !== 'PASSENGER' && payload.role !== 'DRIVER')) throw new Error('bad claims');
      return payload;
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in again');
    }
  },
};
