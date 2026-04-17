import { Request, Response, NextFunction } from 'express';
import { TokenPayload, Rol } from '@biosur/shared';
import { AuthService, AuthError } from '../services/auth.service';
import pool from '../db/pool';
import redis from '../db/redis';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const authService = new AuthService(pool, redis);

/**
 * Authenticate middleware — extracts and validates the JWT token from
 * the Authorization header, attaching the decoded TokenPayload to req.user.
 */
export function authenticate(
  authSvc: AuthService = authService,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const payload = await authSvc.validateToken(token);
      req.user = payload;
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

/**
 * Authorize middleware factory — takes an array of allowed roles and checks
 * req.user.rol. Returns HTTP 403 for unauthorized access and logs the attempt
 * to the log_auditoria table.
 */
export function authorize(
  rolesPermitidos: Rol[],
  poolInstance = pool,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (rolesPermitidos.includes(user.rol)) {
      next();
      return;
    }

    // Log unauthorized access attempt to log_auditoria
    const recurso = `${req.method} ${req.path}`;
    try {
      await poolInstance.query(
        `INSERT INTO log_auditoria (id, usuario_id, accion, recurso, codigo_http, detalles, creado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          user.userId,
          'acceso_no_autorizado',
          recurso,
          403,
          JSON.stringify({ rol: user.rol, rolesPermitidos }),
        ],
      );
    } catch {
      // Audit logging failure should not block the response
    }

    res.status(403).json({ error: 'Acceso no autorizado' });
  };
}
