import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Rol, FormatoFoto, NivelRiesgo } from '@biosur/shared';
import { ReporteFallaService } from '../services/reporte-falla.service';
import { ValidationError } from '../services/inspeccion.service';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize } from '../middleware/rbac.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10_485_760 }, // 10 MB
});

function mapMimeToFormato(mimetype: string): FormatoFoto | null {
  if (mimetype === 'image/jpeg') return FormatoFoto.JPEG;
  if (mimetype === 'image/png') return FormatoFoto.PNG;
  return null;
}

export function createReporteFallaRouter(
  reporteFallaService: ReporteFallaService,
  authService: AuthService,
): Router {
  const router = Router();

  // POST /reportes-falla — Conductor: crear reporte de falla con fotos
  router.post(
    '/',
    authenticate(authService),
    authorize([Rol.CONDUCTOR]),
    upload.array('fotografias'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { inspeccionId, codigoVerificacionId, valor, descripcion } = req.body;
        const files = req.files as Express.Multer.File[] | undefined;

        const fotografias = (files || []).map((file) => {
          const formato = mapMimeToFormato(file.mimetype);
          return {
            archivo: file.buffer,
            formato: formato ?? ('' as FormatoFoto),
            tamanoBytes: file.size,
          };
        });

        const reporte = await reporteFallaService.crear({
          inspeccionId,
          codigoVerificacionId: Number(codigoVerificacionId),
          valor: Number(valor),
          descripcion,
          fotografias,
        });

        res.status(201).json(reporte);
      } catch (err) {
        if (err instanceof ValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  // GET /reportes-falla?semaforo=X — Administrador: filtrar por semáforo
  router.get(
    '/',
    authenticate(authService),
    authorize([Rol.ADMINISTRADOR]),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const semaforo = req.query.semaforo as string | undefined;

        if (semaforo) {
          const validNiveles = Object.values(NivelRiesgo) as string[];
          if (!validNiveles.includes(semaforo)) {
            res.status(400).json({ error: 'Nivel de semáforo inválido' });
            return;
          }
          const reportes = await reporteFallaService.obtenerPorSemaforo(
            semaforo as NivelRiesgo,
          );
          res.status(200).json(reportes);
          return;
        }

        // If unidadId is provided, filter by unit
        const unidadId = req.query.unidadId as string | undefined;
        if (unidadId) {
          const filtros: { semaforo?: NivelRiesgo; fechaDesde?: Date; fechaHasta?: Date } = {};
          if (req.query.fechaDesde) {
            filtros.fechaDesde = new Date(req.query.fechaDesde as string);
          }
          if (req.query.fechaHasta) {
            filtros.fechaHasta = new Date(req.query.fechaHasta as string);
          }
          const reportes = await reporteFallaService.obtenerPorUnidad(
            unidadId,
            Object.keys(filtros).length > 0 ? filtros : undefined,
          );
          res.status(200).json(reportes);
          return;
        }

        res.status(400).json({ error: 'Se requiere el parámetro semaforo o unidadId' });
      } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },
  );

  return router;
}
