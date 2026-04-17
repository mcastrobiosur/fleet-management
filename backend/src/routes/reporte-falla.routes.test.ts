import request from 'supertest';
import express from 'express';
import { createReporteFallaRouter } from './reporte-falla.routes';
import { ReporteFallaService } from '../services/reporte-falla.service';
import { ValidationError } from '../services/inspeccion.service';
import { AuthService } from '../services/auth.service';
import { Rol, NivelRiesgo } from '@biosur/shared';

// --- Helpers ---

function buildMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
    ...overrides,
  } as unknown as AuthService;
}

function buildMockReporteFallaService(
  overrides: Partial<ReporteFallaService> = {},
): ReporteFallaService {
  return {
    crear: jest.fn(),
    obtenerPorUnidad: jest.fn(),
    obtenerPorSemaforo: jest.fn(),
    ...overrides,
  } as unknown as ReporteFallaService;
}

function createTestApp(
  reporteFallaService: ReporteFallaService,
  authService: AuthService,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/reportes-falla', createReporteFallaRouter(reporteFallaService, authService));
  return app;
}

function conductorAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'conductor-1',
    rol: Rol.CONDUCTOR,
    unidadId: 'unidad-1',
  });
}

function adminAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'admin-1',
    rol: Rol.ADMINISTRADOR,
  });
}

const sampleReporte = {
  id: 'reporte-1',
  inspeccionId: 'insp-1',
  unidadId: 'unidad-1',
  codigoVerificacionId: 3,
  valor: 5,
  descripcion: 'Falla en frenos',
  semaforoRiesgo: NivelRiesgo.CRITICO,
  creadoEn: new Date('2024-06-01T09:00:00Z'),
};

// --- Tests ---

describe('Reporte Falla Routes', () => {
  // =========================================================
  // POST /reportes-falla
  // =========================================================
  describe('POST /reportes-falla', () => {
    it('should return 201 when conductor creates a valid report with photo', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const reporteService = buildMockReporteFallaService({
        crear: jest.fn().mockResolvedValue(sampleReporte),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .set('Authorization', 'Bearer valid-token')
        .field('inspeccionId', 'insp-1')
        .field('codigoVerificacionId', '3')
        .field('valor', '5')
        .field('descripcion', 'Falla en frenos')
        .attach('fotografias', Buffer.from('fake-jpeg-data'), {
          filename: 'foto1.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('reporte-1');
      expect(reporteService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          inspeccionId: 'insp-1',
          codigoVerificacionId: 3,
          valor: 5,
          descripcion: 'Falla en frenos',
        }),
      );
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const reporteService = buildMockReporteFallaService();
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .field('inspeccionId', 'insp-1');

      expect(res.status).toBe(401);
    });

    it('should return 403 when admin tries to create a report', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService();
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .set('Authorization', 'Bearer admin-token')
        .field('inspeccionId', 'insp-1')
        .field('codigoVerificacionId', '3')
        .field('valor', '5')
        .field('descripcion', 'Falla');

      expect(res.status).toBe(403);
    });

    it('should return 422 when service throws ValidationError', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const reporteService = buildMockReporteFallaService({
        crear: jest.fn().mockRejectedValue(
          new ValidationError('Se requiere al menos una fotografía', 422),
        ),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .set('Authorization', 'Bearer valid-token')
        .field('inspeccionId', 'insp-1')
        .field('codigoVerificacionId', '3')
        .field('valor', '5')
        .field('descripcion', 'Falla');

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Se requiere al menos una fotografía');
    });

    it('should return 413 when photo exceeds size limit', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const reporteService = buildMockReporteFallaService({
        crear: jest.fn().mockRejectedValue(
          new ValidationError('La imagen excede el tamaño máximo de 10 MB', 413),
        ),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .set('Authorization', 'Bearer valid-token')
        .field('inspeccionId', 'insp-1')
        .field('codigoVerificacionId', '3')
        .field('valor', '5')
        .field('descripcion', 'Falla')
        .attach('fotografias', Buffer.from('x'), {
          filename: 'foto.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('La imagen excede el tamaño máximo de 10 MB');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const reporteService = buildMockReporteFallaService({
        crear: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .post('/reportes-falla')
        .set('Authorization', 'Bearer valid-token')
        .field('inspeccionId', 'insp-1')
        .field('codigoVerificacionId', '3')
        .field('valor', '5')
        .field('descripcion', 'Falla')
        .attach('fotografias', Buffer.from('data'), {
          filename: 'foto.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  // =========================================================
  // GET /reportes-falla?semaforo=X
  // =========================================================
  describe('GET /reportes-falla', () => {
    it('should return 200 with reports filtered by semaforo', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService({
        obtenerPorSemaforo: jest.fn().mockResolvedValue([sampleReporte]),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla?semaforo=critico')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('reporte-1');
      expect(reporteService.obtenerPorSemaforo).toHaveBeenCalledWith(NivelRiesgo.CRITICO);
    });

    it('should return 200 with reports filtered by unidadId', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService({
        obtenerPorUnidad: jest.fn().mockResolvedValue([sampleReporte]),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla?unidadId=unidad-1')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(reporteService.obtenerPorUnidad).toHaveBeenCalledWith('unidad-1', undefined);
    });

    it('should return 400 for invalid semaforo value', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService();
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla?semaforo=invalido')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nivel de semáforo inválido');
    });

    it('should return 400 when no filter params provided', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService();
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Se requiere el parámetro semaforo o unidadId');
    });

    it('should return 403 when conductor tries to list reports', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const reporteService = buildMockReporteFallaService();
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla?semaforo=critico')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const reporteService = buildMockReporteFallaService({
        obtenerPorSemaforo: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const app = createTestApp(reporteService, authService);

      const res = await request(app)
        .get('/reportes-falla?semaforo=critico')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
    });
  });
});
