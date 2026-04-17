import request from 'supertest';
import express from 'express';
import { createDashboardRouter } from './dashboard.routes';
import { BIService } from '../services/bi.service';
import { AuthService } from '../services/auth.service';
import { Rol, IndicadoresFlota } from '@biosur/shared';
import { Pool } from 'pg';

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

function buildMockBIService(overrides: Partial<BIService> = {}): BIService {
  return {
    calcularIndicadores: jest.fn(),
    exportarCSV: jest.fn(),
    ...overrides,
  } as unknown as BIService;
}

function buildMockPool(rows: unknown[] = []): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

function createTestApp(
  biService: BIService,
  authService: AuthService,
  pool?: Pool,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/dashboard', createDashboardRouter(biService, authService, pool));
  return app;
}

function adminAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'admin-1',
    rol: Rol.ADMINISTRADOR,
  });
}

function conductorAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'conductor-1',
    rol: Rol.CONDUCTOR,
    unidadId: 'unidad-1',
  });
}

const sampleIndicadores: IndicadoresFlota = {
  porcentajeUnidadesOperativas: 75,
  tiempoPromedioReparacion: 12.5,
  frecuenciaFallasPorUnidad: { 'unidad-1': 3, 'unidad-2': 1 },
  periodo: { desde: new Date('2024-01-01'), hasta: new Date('2024-01-31') },
};

// --- Tests ---

describe('Dashboard Routes', () => {
  describe('GET /dashboard/bi', () => {
    it('should return 200 with indicators for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService({
        calcularIndicadores: jest.fn().mockResolvedValue(sampleIndicadores),
      });
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.porcentajeUnidadesOperativas).toBe(75);
      expect(res.body.tiempoPromedioReparacion).toBe(12.5);
      expect(res.body.frecuenciaFallasPorUnidad).toEqual({ 'unidad-1': 3, 'unidad-2': 1 });
    });

    it('should return 400 when desde is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('desde');
    });

    it('should return 400 when hasta is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=2024-01-01')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('hasta');
    });

    it('should return 400 for invalid date format', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=not-a-date&hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Formato de fecha inválido');
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=2024-01-01&hasta=2024-01-31');

      expect(res.status).toBe(401);
    });

    it('should return 403 when conductor tries to access', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService({
        calcularIndicadores: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  describe('GET /dashboard/bi/exportar', () => {
    it('should return 200 with CSV content for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const csvContent = Buffer.from('Indicador,Valor\nPorcentaje,75', 'utf-8');
      const biService = buildMockBIService({
        exportarCSV: jest.fn().mockResolvedValue(csvContent),
      });
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi/exportar?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.csv');
      expect(res.text).toContain('Indicador,Valor');
    });

    it('should return 400 when desde is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi/exportar?hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid date format', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi/exportar?desde=bad&hasta=bad')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Formato de fecha inválido');
    });

    it('should return 403 when conductor tries to export', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const biService = buildMockBIService();
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi/exportar?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService({
        exportarCSV: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(biService, authService);

      const res = await request(app)
        .get('/dashboard/bi/exportar?desde=2024-01-01&hasta=2024-01-31')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /dashboard/estado-flota', () => {
    const sampleUnidades = [
      { id: 'u1', marca: 'Ford', modelo: 'Transit', patente: 'ABC123', anio: 2022, estado: 'operativa' },
      { id: 'u2', marca: 'Mercedes', modelo: 'Sprinter', patente: 'DEF456', anio: 2021, estado: 'bloqueada' },
    ];

    it('should return 200 with all units for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const pool = buildMockPool(sampleUnidades);
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual(expect.objectContaining({ id: 'u1', marca: 'Ford', estado: 'operativa' }));
      expect(res.body[1]).toEqual(expect.objectContaining({ id: 'u2', marca: 'Mercedes', estado: 'bloqueada' }));
    });

    it('should return empty array when no units exist', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const pool = buildMockPool([]);
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const biService = buildMockBIService();
      const pool = buildMockPool();
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota');

      expect(res.status).toBe(401);
    });

    it('should return 403 when conductor tries to access', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const biService = buildMockBIService();
      const pool = buildMockPool();
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 500 when database query fails', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const pool = {
        query: jest.fn().mockRejectedValue(new Error('DB down')),
      } as unknown as Pool;
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });

    it('should return units with correct fields only', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const biService = buildMockBIService();
      const pool = buildMockPool(sampleUnidades);
      const app = createTestApp(biService, authService, pool);

      const res = await request(app)
        .get('/dashboard/estado-flota')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      for (const unit of res.body) {
        expect(unit).toHaveProperty('id');
        expect(unit).toHaveProperty('marca');
        expect(unit).toHaveProperty('modelo');
        expect(unit).toHaveProperty('patente');
        expect(unit).toHaveProperty('anio');
        expect(unit).toHaveProperty('estado');
      }
    });
  });
});
