import { Router, Request, Response } from 'express';
import { Rol, EstadoTicket } from '@biosur/shared';
import { TicketService, TransitionError } from '../services/ticket.service';
import { ValidationError } from '../services/inspeccion.service';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

export function createTicketRouter(
  ticketService: TicketService,
  authService: AuthService,
): Router {
  const router = Router();

  // POST /tickets/:id/asignar — Administrador
  router.post(
    '/:id/asignar',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const ticketId = req.params.id;
        const { equipoMantenimientoId } = req.body;

        if (!equipoMantenimientoId) {
          res.status(400).json({ error: 'equipoMantenimientoId es requerido' });
          return;
        }

        const ticket = await ticketService.asignar(ticketId, equipoMantenimientoId);
        res.status(200).json(ticket);
      } catch (err) {
        if (err instanceof TransitionError) {
          res.status(409).json({
            error: 'Transición no permitida',
            estadoActual: err.estadoActual,
            estadoSolicitado: err.estadoSolicitado,
          });
          return;
        }
        if (err instanceof ValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // POST /tickets/:id/cerrar — Equipo_Mantenimiento
  router.post(
    '/:id/cerrar',
    authenticate(authService),
    authorize([Rol.EQUIPO_MANTENIMIENTO]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const ticketId = req.params.id;
        const { trabajoRealizado, validacionReparacion } = req.body;
        const userId = req.user!.userId;

        const ticket = await ticketService.cerrar(ticketId, {
          trabajoRealizado,
          validacionReparacion,
          userId,
        });
        res.status(200).json(ticket);
      } catch (err) {
        if (err instanceof TransitionError) {
          res.status(409).json({
            error: 'Transición no permitida',
            estadoActual: err.estadoActual,
            estadoSolicitado: err.estadoSolicitado,
          });
          return;
        }
        if (err instanceof ValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /tickets?unidadId=X — Administrador
  // GET /tickets?asignadoA=X — Equipo_Mantenimiento
  router.get(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR, Rol.EQUIPO_MANTENIMIENTO]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const unidadId = req.query.unidadId as string | undefined;
        const asignadoA = req.query.asignadoA as string | undefined;

        if (unidadId) {
          const tickets = await ticketService.obtenerPorUnidad(unidadId);
          res.status(200).json(tickets);
          return;
        }

        if (asignadoA) {
          const tickets = await ticketService.obtenerPorAsignado(asignadoA);
          res.status(200).json(tickets);
          return;
        }

        // Admin can list all tickets with no filter
        if (req.user?.rol === Rol.ADMINISTRADOR) {
          const tickets = await ticketService.obtenerTodos();
          res.status(200).json(tickets);
          return;
        }

        res.status(400).json({ error: 'Se requiere el parámetro unidadId o asignadoA' });
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  return router;
}
