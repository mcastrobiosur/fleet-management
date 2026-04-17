import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Rol } from '@biosur/shared';
import { BIService } from '../services/bi.service';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

export function createDashboardRouter(
  biService: BIService,
  authService: AuthService,
  poolInstance?: Pool,
): Router {
  const router = Router();

  // GET /dashboard/estado-flota — Administrador: estado actual de todas las unidades
  router.get(
    '/estado-flota',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (_req: Request, res: Response): Promise<void> => {
      try {
        if (!poolInstance) {
          res.status(500).json({ error: 'Error interno del servidor' });
          return;
        }
        const result = await poolInstance.query(
          `SELECT u.id, u.marca, u.modelo, u.patente, u.anio, u.estado,
                  TO_CHAR(MAX(i.creado_en), 'DD/MM/YYYY') AS "ultimaInspeccion"
           FROM unidad u
           LEFT JOIN inspeccion i ON i.unidad_id = u.id
           GROUP BY u.id
           ORDER BY u.marca, u.modelo`,
        );
        res.status(200).json(result.rows);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /dashboard/bi?desde=X&hasta=Y — Administrador
  router.get(
    '/bi',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { desde, hasta } = req.query;

        if (!desde || !hasta) {
          res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos' });
          return;
        }

        const filtros = {
          desde: new Date(desde as string),
          hasta: new Date(hasta as string),
        };

        if (isNaN(filtros.desde.getTime()) || isNaN(filtros.hasta.getTime())) {
          res.status(400).json({ error: 'Formato de fecha inválido' });
          return;
        }

        const indicadores = await biService.calcularIndicadores(filtros);
        res.status(200).json(indicadores);
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /dashboard/bi/exportar?desde=X&hasta=Y — Administrador (descarga CSV)
  router.get(
    '/bi/exportar',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { desde, hasta } = req.query;

        if (!desde || !hasta) {
          res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos' });
          return;
        }

        const filtros = {
          desde: new Date(desde as string),
          hasta: new Date(hasta as string),
        };

        if (isNaN(filtros.desde.getTime()) || isNaN(filtros.hasta.getTime())) {
          res.status(400).json({ error: 'Formato de fecha inválido' });
          return;
        }

        const csvBuffer = await biService.exportarCSV(filtros);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="bi-report-${desde}-${hasta}.csv"`,
        );
        res.status(200).send(csvBuffer);
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  return router;
}
