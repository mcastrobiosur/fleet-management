import request from 'supertest';
import express from 'express';
import { createInspeccionRouter } from './inspeccion.routes';
import { InspeccionService } from '../services/inspeccion.service';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { Rol } from '@biosur/shared';

// --- Helpers ---

function buildMockAuthService(): AuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
  } as unknown as AuthService;
}

function buildMockInspeccionService(): InspeccionService {
  return {
    crear: jest.fn(),
    obtenerPorUnidad: jest.fn(),
    obtenerPorConductor: jest.fn(),
  } as unknown as InspeccionService;
}

function buildMockSyncService(overrides: Partial<SyncService> = {}): SyncService {
  return {
    sincronizarLote: jest.fn().mockResolvedValue({
      exitosos: 0,
      fallidos: 0,
      conflictos: [],
    }),
    ...overrides,
  } as unknown as SyncService;
}

function createTestApp(
  inspeccionService: InspeccionService,
  authService: AuthService,
  syncService: SyncService,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/inspecciones', createInspeccionRouter(inspeccionService, authService, syncService));
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

const sampleInspecciones = [
  {
    operacionId: 'op-1',
    datos: {
      unidadId: 'unidad-1',
      codigos: Array.from({ length: 39 }, (_, i) => ({ codigoId: i + 1, valor: 0 })),
      creadoOffline: true,
      timestampLocal: '2024-06-01T08:00:00Z',
    },
  },
];

// --- Tests ---

describe('POST /inspecciones/sync', () => {
  it('should return 200 with sync result for conductor', async () => {
    const authService = buildMockAuthService();
    conductorAuth(authService);
    const syncService = buildMockSyncService({
      sincronizarLote: jest.fn().mockResolvedValue({
        exitosos: 1,
        fallidos: 0,
        conflictos: [],
      }),
    });
    const app = createTestApp(buildMockInspeccionService(), authService, syncService);

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({ inspecciones: sampleInspecciones });

    expect(res.status).toBe(200);
    expect(res.body.exitosos).toBe(1);
    expect(res.body.fallidos).toBe(0);
    expect(res.body.conflictos).toHaveLength(0);
    expect(syncService.sincronizarLote).toHaveBeenCalledWith(
      'conductor-1',
      sampleInspecciones,
    );
  });

  it('should return 401 when no token is provided', async () => {
    const authService = buildMockAuthService();
    const app = createTestApp(
      buildMockInspeccionService(),
      authService,
      buildMockSyncService(),
    );

    const res = await request(app)
      .post('/inspecciones/sync')
      .send({ inspecciones: sampleInspecciones });

    expect(res.status).toBe(401);
  });

  it('should return 403 when admin tries to sync', async () => {
    const authService = buildMockAuthService();
    adminAuth(authService);
    const app = createTestApp(
      buildMockInspeccionService(),
      authService,
      buildMockSyncService(),
    );

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer admin-token')
      .send({ inspecciones: sampleInspecciones });

    expect(res.status).toBe(403);
  });

  it('should return 400 when inspecciones array is missing', async () => {
    const authService = buildMockAuthService();
    conductorAuth(authService);
    const app = createTestApp(
      buildMockInspeccionService(),
      authService,
      buildMockSyncService(),
    );

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Se requiere un array de inspecciones');
  });

  it('should return 400 when inspecciones is empty array', async () => {
    const authService = buildMockAuthService();
    conductorAuth(authService);
    const app = createTestApp(
      buildMockInspeccionService(),
      authService,
      buildMockSyncService(),
    );

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({ inspecciones: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Se requiere un array de inspecciones');
  });

  it('should return 200 with conflict info when conflicts exist', async () => {
    const authService = buildMockAuthService();
    conductorAuth(authService);
    const syncService = buildMockSyncService({
      sincronizarLote: jest.fn().mockResolvedValue({
        exitosos: 0,
        fallidos: 0,
        conflictos: [{
          operacionId: 'op-1',
          razon: 'Inspección existente para la misma unidad en el mismo período',
          datosLocales: {},
          datosServidor: {},
        }],
      }),
    });
    const app = createTestApp(buildMockInspeccionService(), authService, syncService);

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({ inspecciones: sampleInspecciones });

    expect(res.status).toBe(200);
    expect(res.body.conflictos).toHaveLength(1);
    expect(res.body.conflictos[0].operacionId).toBe('op-1');
  });

  it('should return 500 when sync service throws unexpected error', async () => {
    const authService = buildMockAuthService();
    conductorAuth(authService);
    const syncService = buildMockSyncService({
      sincronizarLote: jest.fn().mockRejectedValue(new Error('Unexpected')),
    });
    const app = createTestApp(buildMockInspeccionService(), authService, syncService);

    const res = await request(app)
      .post('/inspecciones/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({ inspecciones: sampleInspecciones });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
  });
});
