import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

export const authRoutes = Router()
  .post('/signup', authLimiter, authController.signup)
  .post('/login', authLimiter, authController.login)
  .post('/logout', authController.logout)
  .get('/me', requireAuth, authController.me);
