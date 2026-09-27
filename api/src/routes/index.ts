import { Router } from 'express';
import { authRoutes } from './auth.routes';

export const apiRoutes = Router().use('/auth', authRoutes);
