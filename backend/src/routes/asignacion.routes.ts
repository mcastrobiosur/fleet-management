import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Rol } from '@biosur/shared';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

export function createAsignacionRouter(
  poolInstance: Pool,
  authService: AuthService,
): Router {
  const router = Router();

  // GET /asignaciones?fecha=YYYY-MM-DD — Administrador: listar asignaciones por fecha
  router.get(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const fecha = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);

        const result = await poolInstance.query(
          `SELECT ac.id, ac.conductor_id, ac.unidad_id, ac.fecha_jornada, ac.creado_en,
                  u.nombre AS conductor_nombre, u.email AS conductor_email,
                  un.marca, un.modelo, un.patente
           FROM asignacion_conductor ac
           JOIN usuario u ON u.id = ac.conductor_id
           JOIN unidad un ON un.id = ac.unidad_id
           WHERE ac.fecha_jornada = $1
           ORDER BY u.nombre`,
          [fecha],
        );

        res.status(200).json(result.rows);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /asignaciones — Administrador: crear asignación
  router.post(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { conductorId, unidadId, fechaJornada } = req.body;

        if (!conductorId || !unidadId || !fechaJornada) {
          res.status(400).json({ error: 'conductorId, unidadId y fechaJornada son requeridos' });
          return;
        }

        // Check conductor exists and has role 'conductor'
        const conductorCheck = await poolInstance.query(
          `SELECT id FROM usuario WHERE id = $1 AND rol = 'conductor' AND activo = true`,
          [conductorId],
        );
        if (conductorCheck.rows.length === 0) {
          res.status(422).json({ error: 'Conductor no encontrado o inactivo' });
          return;
        }

        // Check unidad exists
        const unidadCheck = await poolInstance.query(
          `SELECT id FROM unidad WHERE id = $1`,
          [unidadId],
        );
        if (unidadCheck.rows.length === 0) {
          res.status(422).json({ error: 'Unidad no encontrada' });
          return;
        }

        // Check no duplicate assignment for same conductor + date
        const duplicateCheck = await poolInstance.query(
          `SELECT id FROM asignacion_conductor WHERE conductor_id = $1 AND fecha_jornada = $2`,
          [conductorId, fechaJornada],
        );
        if (duplicateCheck.rows.length > 0) {
          res.status(409).json({ error: 'El conductor ya tiene una asignación para esa fecha' });
          return;
        }

        const client = await poolInstance.connect();
        try {
          await client.query('BEGIN');

          const result = await client.query(
            `INSERT INTO asignacion_conductor (conductor_id, unidad_id, fecha_jornada)
             VALUES ($1, $2, $3)
             RETURNING id, conductor_id, unidad_id, fecha_jornada, creado_en`,
            [conductorId, unidadId, fechaJornada],
          );

          await client.query(
            `UPDATE unidad SET estado = 'operativa' WHERE id = $1 AND estado = 'disponible'`,
            [unidadId],
          );

          await client.query('COMMIT');
          res.status(201).json(result.rows[0]);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // DELETE /asignaciones/:id — Administrador: eliminar asignación
  router.delete(
    '/:id',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;

        const client = await poolInstance.connect();
        try {
          await client.query('BEGIN');

          const result = await client.query(
            `DELETE FROM asignacion_conductor WHERE id = $1 RETURNING id, unidad_id`,
            [id],
          );

          if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ error: 'Asignación no encontrada' });
            return;
          }

          await client.query(
            `UPDATE unidad SET estado = 'disponible' WHERE id = $1 AND estado = 'operativa'`,
            [result.rows[0].unidad_id],
          );

          await client.query('COMMIT');
          res.status(200).json({ message: 'Asignación eliminada' });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /asignaciones/conductores — Administrador: listar conductores disponibles
  router.get(
    '/conductores',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const result = await poolInstance.query(
          `SELECT id, nombre, email FROM usuario WHERE rol = 'conductor' AND activo = true ORDER BY nombre`,
        );
        res.status(200).json(result.rows);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /asignaciones/unidades — Administrador: listar unidades disponibles
  router.get(
    '/unidades',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const result = await poolInstance.query(
          `SELECT id, marca, modelo, patente, anio, estado FROM unidad ORDER BY marca, modelo`,
        );
        res.status(200).json(result.rows);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  return router;
}
