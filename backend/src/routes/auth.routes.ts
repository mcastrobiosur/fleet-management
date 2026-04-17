import { Router, Request, Response } from 'express';
import { AuthService, AuthError } from '../services/auth.service';
import { authenticate } from '../middleware/rbac.middleware';
import { Rol } from '@biosur/shared';

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  // POST /auth/login — público (no auth required)
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña son requeridos' });
        return;
      }

      const result = await authService.login({ email, password });
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // POST /auth/logout — todos los roles (requires authentication)
  router.post(
    '/logout',
    authenticate(authService),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const token = req.headers.authorization!.slice(7);
        await authService.logout(token);
        res.status(200).json({ message: 'Sesión cerrada exitosamente' });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /auth/refresh — todos los roles (no auth required, uses refresh token from body)
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token es requerido' });
        return;
      }

      const result = await authService.refreshToken(refreshToken);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
