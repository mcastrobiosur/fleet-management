import request from 'supertest';
import express from 'express';
import { createInspeccionRouter } from './inspeccion.routes';
import { InspeccionService, ValidationError } from '../services/inspeccion.service';
import { AuthService } from '../services/auth.service';
import { Rol } from '@biosur/shared';

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

function buildMockInspeccionService(
  overrides: Partial<InspeccionService> = {},
): InspeccionService {
  return {
    crear: jest.fn(),
    obtenerPorUnidad: jest.fn(),
    obtenerPorConductor: jest.fn(),
    ...overrides,
  } as unknown as InspeccionService;
}

function createTestApp(
  inspeccionService: InspeccionService,
  authService: AuthService,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/inspecciones', createInspeccionRouter(inspeccionService, authService));
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

const sampleInspeccion = {
  id: 'insp-1',
  conductorId: 'conductor-1',
  unidadId: 'unidad-1',
  timestampLocal: new Date('2024-06-01T08:00:00Z'),
  timestampServidor: new Date('2024-06-01T08:00:01Z'),
  creadoOffline: false,
  creadoEn: new Date('2024-06-01T08:00:01Z'),
};

// --- Tests ---

describe('Inspeccion Routes', () => {
  // =========================================================
  // POST /inspecciones
  // =========================================================
  describe('POST /inspecciones', () => {
    it('should return 201 when conductor creates a valid inspection', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        crear: jest.fn().mockResolvedValue(sampleInspeccion),
      });
      const app = createTestApp(inspeccionService, authService);

      const codigos = Array.from({ length: 39 }, (_, i) => ({
        codigoId: i + 1,
        valor: 0,
      }));

      const res = await request(app)
        .post('/inspecciones')
        .set('Authorization', 'Bearer valid-token')
        .send({ unidadId: 'unidad-1', codigos, timestampLocal: '2024-06-01T08:00:00Z' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('insp-1');
      expect(inspeccionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          conductorId: 'conductor-1',
          unidadId: 'unidad-1',
        }),
      );
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const inspeccionService = buildMockInspeccionService();
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app).post('/inspecciones').send({});

      expect(res.status).toBe(401);
    });

    it('should return 403 when administrador tries to create inspection', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const inspeccionService = buildMockInspeccionService();
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .post('/inspecciones')
        .set('Authorization', 'Bearer admin-token')
        .send({ unidadId: 'unidad-1', codigos: [] });

      expect(res.status).toBe(403);
    });

    it('should return 422 with camposPendientes for incomplete inspection', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        crear: jest.fn().mockRejectedValue(
          new ValidationError('Inspección incompleta', 422, [5, 10, 15]),
        ),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .post('/inspecciones')
        .set('Authorization', 'Bearer valid-token')
        .send({ unidadId: 'unidad-1', codigos: [] });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Inspección incompleta');
      expect(res.body.camposPendientes).toEqual([5, 10, 15]);
    });

    it('should return 422 for validation error without camposPendientes', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        crear: jest.fn().mockRejectedValue(
          new ValidationError('Valor inválido', 422),
        ),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .post('/inspecciones')
        .set('Authorization', 'Bearer valid-token')
        .send({ unidadId: 'unidad-1', codigos: [] });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Valor inválido');
      expect(res.body.camposPendientes).toBeUndefined();
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        crear: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .post('/inspecciones')
        .set('Authorization', 'Bearer valid-token')
        .send({ unidadId: 'unidad-1', codigos: [] });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  // =========================================================
  // GET /inspecciones?unidadId=X
  // =========================================================
  describe('GET /inspecciones', () => {
    it('should return 200 with inspections for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        obtenerPorUnidad: jest.fn().mockResolvedValue([sampleInspeccion]),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .get('/inspecciones?unidadId=unidad-1')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('insp-1');
      expect(inspeccionService.obtenerPorUnidad).toHaveBeenCalledWith('unidad-1', undefined);
    });

    it('should return 400 when unidadId is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const inspeccionService = buildMockInspeccionService();
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .get('/inspecciones')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('El parámetro unidadId es requerido');
    });

    it('should return 403 when conductor tries to list inspections', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const inspeccionService = buildMockInspeccionService();
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .get('/inspecciones?unidadId=unidad-1')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should pass date filters when provided', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        obtenerPorUnidad: jest.fn().mockResolvedValue([]),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .get('/inspecciones?unidadId=unidad-1&fechaDesde=2024-01-01&fechaHasta=2024-12-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(inspeccionService.obtenerPorUnidad).toHaveBeenCalledWith(
        'unidad-1',
        expect.objectContaining({
          fechaDesde: expect.any(Date),
          fechaHasta: expect.any(Date),
        }),
      );
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const inspeccionService = buildMockInspeccionService({
        obtenerPorUnidad: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const app = createTestApp(inspeccionService, authService);

      const res = await request(app)
        .get('/inspecciones?unidadId=unidad-1')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
    });
  });
});
