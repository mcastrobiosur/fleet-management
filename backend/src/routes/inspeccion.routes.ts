import { Router, Request, Response } from 'express';
import { Rol } from '@biosur/shared';
import { InspeccionService, ValidationError } from '../services/inspeccion.service';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

export function createInspeccionRouter(
  inspeccionService: InspeccionService,
  authService: AuthService,
  syncService?: SyncService,
): Router {
  const router = Router();

  // POST /inspecciones — Conductor: registrar inspección
  router.post(
    '/',
    authenticate(authService),
    authorize([Rol.CONDUCTOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { unidadId, codigos, creadoOffline, timestampLocal } = req.body;
        const conductorId = req.user!.userId;

        const inspeccion = await inspeccionService.crear({
          conductorId,
          unidadId,
          codigos,
          creadoOffline: creadoOffline ?? false,
          timestampLocal: timestampLocal ? new Date(timestampLocal) : new Date(),
        });

        res.status(201).json(inspeccion);
      } catch (err) {
        if (err instanceof ValidationError) {
          const body: Record<string, unknown> = { error: err.message };
          if (err.camposPendientes) {
            body.camposPendientes = err.camposPendientes;
          }
          res.status(err.statusCode).json(body);
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /inspecciones/:id — Administrador: detalle de una inspección con sus 39 códigos
  router.get(
    '/:id',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await inspeccionService.obtenerDetalle(req.params.id);
        if (!result) {
          res.status(404).json({ error: 'Inspección no encontrada' });
          return;
        }
        res.status(200).json(result);
      } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /inspecciones/:id/tickets — Administrador: crear ticket desde detalle de inspección
  router.post(
    '/:id/tickets',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const inspeccionId = req.params.id;
        const { codigoVerificacionId, descripcion } = req.body;

        if (!codigoVerificacionId) {
          res.status(400).json({ error: 'codigoVerificacionId es requerido' });
          return;
        }

        // Get inspeccion + unidad
        const inspeccionResult = await (inspeccionService as any).pool.query(
          'SELECT id, unidad_id FROM inspeccion WHERE id = $1',
          [inspeccionId],
        );
        if (inspeccionResult.rows.length === 0) {
          res.status(404).json({ error: 'Inspección no encontrada' });
          return;
        }
        const unidadId = inspeccionResult.rows[0].unidad_id as string;

        // Get nivel_riesgo from codigo_verificacion
        const codigoResult = await (inspeccionService as any).pool.query(
          'SELECT nivel_riesgo FROM codigo_verificacion WHERE id = $1',
          [Number(codigoVerificacionId)],
        );
        if (codigoResult.rows.length === 0) {
          res.status(400).json({ error: 'Código de verificación no encontrado' });
          return;
        }
        const nivelRiesgo = codigoResult.rows[0].nivel_riesgo as string;

        if (nivelRiesgo !== 'critico' && nivelRiesgo !== 'preventivo') {
          res.status(422).json({ error: 'Solo se pueden crear tickets para fallas críticas o preventivas' });
          return;
        }

        // Check duplicate
        const dupResult = await (inspeccionService as any).pool.query(
          `SELECT t.id FROM ticket t
           JOIN reporte_falla rf ON rf.id = t.reporte_falla_id
           WHERE rf.inspeccion_id = $1 AND rf.codigo_verificacion_id = $2`,
          [inspeccionId, Number(codigoVerificacionId)],
        );
        if (dupResult.rows.length > 0) {
          res.status(409).json({ error: 'Ya existe un ticket para este código en esta inspección', ticketId: dupResult.rows[0].id });
          return;
        }

        // Get valor from detalle_inspeccion
        const detalleResult = await (inspeccionService as any).pool.query(
          'SELECT valor FROM detalle_inspeccion WHERE inspeccion_id = $1 AND codigo_verificacion_id = $2',
          [inspeccionId, Number(codigoVerificacionId)],
        );
        const valor = detalleResult.rows[0]?.valor ?? Number(codigoVerificacionId);

        const client = await (inspeccionService as any).pool.connect();
        try {
          await client.query('BEGIN');

          const reporteResult = await client.query(
            `INSERT INTO reporte_falla (inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [inspeccionId, unidadId, Number(codigoVerificacionId), valor, descripcion || '', nivelRiesgo],
          );
          const reporteFallaId = reporteResult.rows[0].id as string;

          const ticketResult = await client.query(
            `INSERT INTO ticket (reporte_falla_id, unidad_id, estado, semaforo_riesgo)
             VALUES ($1, $2, 'abierto', $3)
             RETURNING id, estado, semaforo_riesgo, creado_en`,
            [reporteFallaId, unidadId, nivelRiesgo],
          );

          await client.query('COMMIT');
          res.status(201).json({ ticketId: ticketResult.rows[0].id, ...ticketResult.rows[0] });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /inspecciones?unidadId=X — Administrador: listar inspecciones por unidad
  router.get(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const unidadId = req.query.unidadId as string | undefined;

        if (!unidadId) {
          res.status(400).json({ error: 'El parámetro unidadId es requerido' });
          return;
        }

        const filtros: { fechaDesde?: Date; fechaHasta?: Date } = {};
        if (req.query.fechaDesde) {
          filtros.fechaDesde = new Date(req.query.fechaDesde as string);
        }
        if (req.query.fechaHasta) {
          filtros.fechaHasta = new Date(req.query.fechaHasta as string);
        }

        const inspecciones = await inspeccionService.obtenerPorUnidad(
          unidadId,
          Object.keys(filtros).length > 0 ? filtros : undefined,
        );

        res.status(200).json(inspecciones);
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /inspecciones/sync — Conductor: sincronizar inspecciones offline
  if (syncService) {
    router.post(
      '/sync',
      authenticate(authService),
      authorize([Rol.CONDUCTOR]),
      async (req: Request, res: Response): Promise<void> => {
        try {
          const conductorId = req.user!.userId;
          const { inspecciones } = req.body;

          if (!Array.isArray(inspecciones) || inspecciones.length === 0) {
            res.status(400).json({ error: 'Se requiere un array de inspecciones' });
            return;
          }

          const result = await syncService.sincronizarLote(conductorId, inspecciones);
          res.status(200).json(result);
        } catch (err) {
          res.status(500).json({ error: 'Error interno del servidor' });
        }
      },
    );
  }

  return router;
}
