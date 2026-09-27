import type { UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: { id: string; role: UserRole };
    }
  }
}

export {};
