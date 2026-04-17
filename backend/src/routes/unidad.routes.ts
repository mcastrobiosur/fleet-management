import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Rol, EstadoUnidad } from '@biosur/shared';
import { BloqueoService, BloqueoError } from '../services/bloqueo.service';
import { HojaVidaService } from '../services/hoja-vida.service';
import { AuthService } from '../services/auth.service';
import { ValidationError } from '../services/inspeccion.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

const VALID_ESTADOS = Object.values(EstadoUnidad) as string[];

export function createUnidadRouter(
  bloqueoService: BloqueoService,
  authService: AuthService,
  hojaVidaService?: HojaVidaService,
  pool?: Pool,
): Router {
  const router = Router();

  // GET /unidades — Administrador: listar todas las unidades
  router.get(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const result = await pool!.query(
          'SELECT id, marca, modelo, patente, anio, estado FROM unidad ORDER BY marca, modelo',
        );
        res.status(200).json(result.rows);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /unidades — Administrador: crear unidad
  router.post(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { marca, modelo, patente, anio } = req.body;
        if (!marca || !modelo || !patente || !anio) {
          res.status(422).json({ error: 'marca, modelo, patente y anio son requeridos' });
          return;
        }
        const result = await pool!.query(
          `INSERT INTO unidad (marca, modelo, patente, anio)
           VALUES ($1, $2, $3, $4)
           RETURNING id, marca, modelo, patente, anio, estado`,
          [marca.trim(), modelo.trim(), patente.trim().toUpperCase(), Number(anio)],
        );
        res.status(201).json(result.rows[0]);
      } catch (err: any) {
        if (err.code === '23505') {
          res.status(409).json({ error: 'Ya existe una unidad con esa patente' });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // PUT /unidades/:id — Administrador: actualizar unidad
  router.put(
    '/:id',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { marca, modelo, patente, anio } = req.body;
        if (!marca || !modelo || !patente || !anio) {
          res.status(422).json({ error: 'marca, modelo, patente y anio son requeridos' });
          return;
        }
        const result = await pool!.query(
          `UPDATE unidad SET marca=$1, modelo=$2, patente=$3, anio=$4
           WHERE id=$5
           RETURNING id, marca, modelo, patente, anio, estado`,
          [marca.trim(), modelo.trim(), patente.trim().toUpperCase(), Number(anio), req.params.id],
        );
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Unidad no encontrada' });
          return;
        }
        res.status(200).json(result.rows[0]);
      } catch (err: any) {
        if (err.code === '23505') {
          res.status(409).json({ error: 'Ya existe una unidad con esa patente' });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // DELETE /unidades/:id — Administrador: eliminar unidad
  router.delete(
    '/:id',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await pool!.query(
          'DELETE FROM unidad WHERE id=$1 RETURNING id',
          [req.params.id],
        );
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Unidad no encontrada' });
          return;
        }
        res.status(204).send();
      } catch (err: any) {
        if (err.code === '23503') {
          res.status(409).json({ error: 'No se puede eliminar: la unidad tiene registros asociados' });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /unidades/:id/hoja-vida — Administrador
  if (hojaVidaService) {
    router.get(
      '/:id/hoja-vida',
      authenticate(authService),
      authorize([Rol.ADMINISTRADOR]),
      async (req: Request, res: Response): Promise<void> => {
        try {
          const unidadId = req.params.id;
          const filtros: Record<string, unknown> = {};

          if (req.query.fechaDesde) {
            filtros.fechaDesde = new Date(req.query.fechaDesde as string);
          }
          if (req.query.fechaHasta) {
            filtros.fechaHasta = new Date(req.query.fechaHasta as string);
          }
          if (req.query.tipoFalla) {
            filtros.tipoFalla = Number(req.query.tipoFalla);
          }
          if (req.query.estadoTicket) {
            filtros.estadoTicket = req.query.estadoTicket as string;
          }

          const hojaVida = await hojaVidaService.obtener(unidadId, filtros);
          res.status(200).json(hojaVida);
        } catch (err) {
          if (err instanceof ValidationError) {
            res.status(err.statusCode).json({ error: err.message });
            return;
          }
          res.status(500).json({ error: 'Error interno del servidor' });
        }
      },
    );
  }

  // PATCH /unidades/:id/estado — Administrador (con validación de bloqueo)
  router.patch(
    '/:id/estado',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const unidadId = req.params.id;
        const { estado } = req.body;

        if (!estado || !VALID_ESTADOS.includes(estado)) {
          res.status(422).json({
            error: 'Estado inválido',
            estadosPermitidos: VALID_ESTADOS,
          });
          return;
        }

        const userId = req.user!.userId;
        await bloqueoService.cambiarEstadoUnidad(unidadId, estado as EstadoUnidad, userId);

        res.status(200).json({ unidadId, estado });
      } catch (err) {
        if (err instanceof BloqueoError) {
          res.status(err.statusCode).json({
            error: err.message,
            ticketsCriticos: err.ticketsCriticos,
          });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  return router;
}
