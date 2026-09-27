import type { RequestHandler, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { authService } from '../services/auth.service';
import type { UserRole } from '../models/user.model';

export const SESSION_COOKIE = 'dtp_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by page JavaScript -> XSS can't steal it
    sameSite: 'lax', // not sent on cross-site POSTs -> basic CSRF protection
    secure: env.COOKIE_SECURE,
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Accepts the session cookie (browser) or a Bearer token (curl / API clients). */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[SESSION_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in');
  const claims = authService.verifyToken(token);
  req.user = { id: claims.sub, role: claims.role };
  next();
};

export const requireRole =
  (role: UserRole): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.role !== role) {
      throw new AppError(403, 'FORBIDDEN', `Only ${role.toLowerCase()}s can do this`);
    }
    next();
  };
