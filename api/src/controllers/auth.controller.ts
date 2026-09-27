import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, signupSchema } from '../validators/auth.validators';
import { clearSessionCookie, setSessionCookie } from '../middlewares/auth';
import { userView, vehicleView } from '../views/user.view';

export const authController = {
  async signup(req: Request, res: Response) {
    const user = await authService.signup(signupSchema.parse(req.body));
    setSessionCookie(res, authService.issueToken(user));
    req.log.info({ userId: user.id }, 'passenger signed up');
    res.status(201).json({ user: userView(user) });
  },

  async login(req: Request, res: Response) {
    const user = await authService.login(loginSchema.parse(req.body));
    setSessionCookie(res, authService.issueToken(user));
    res.json({ user: userView(user) });
  },

  logout(_req: Request, res: Response) {
    clearSessionCookie(res);
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    const { user, vehicle } = await authService.me(req.user!.id);
    res.json({ user: userView(user), vehicle: vehicle ? vehicleView(vehicle) : null });
  },
};
