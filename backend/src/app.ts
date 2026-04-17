import express from 'express';
import cors from 'cors';
import { AuthService } from './services/auth.service';
import { InspeccionService } from './services/inspeccion.service';
import { SyncService } from './services/sync.service';
import { ReporteFallaService } from './services/reporte-falla.service';
import { TicketService } from './services/ticket.service';
import { BloqueoService } from './services/bloqueo.service';
import { SemaforoRiesgoService } from './services/semaforo-riesgo.service';
import { S3StorageService } from './services/storage.service';
import { HojaVidaService } from './services/hoja-vida.service';
import { BIService } from './services/bi.service';
import { createAuthRouter } from './routes/auth.routes';
import { createInspeccionRouter } from './routes/inspeccion.routes';
import { createReporteFallaRouter } from './routes/reporte-falla.routes';
import { createTicketRouter } from './routes/ticket.routes';
import { createUnidadRouter } from './routes/unidad.routes';
import { createDashboardRouter } from './routes/dashboard.routes';
import { createAsignacionRouter } from './routes/asignacion.routes';
import pool from './db/pool';
import redis from './db/redis';

export interface AppDependencies {
  authService?: AuthService;
  inspeccionService?: InspeccionService;
  syncService?: SyncService;
  reporteFallaService?: ReporteFallaService;
  ticketService?: TicketService;
  bloqueoService?: BloqueoService;
  hojaVidaService?: HojaVidaService;
  biService?: BIService;
}

export function createApp(deps: AppDependencies = {}): express.Application {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  const authSvc = deps.authService ?? new AuthService(pool, redis);
  const inspeccionSvc = deps.inspeccionService ?? new InspeccionService(pool);
  const syncSvc = deps.syncService ?? new SyncService(pool, inspeccionSvc);
  const semaforoSvc = new SemaforoRiesgoService(pool);
  const storageSvc = new S3StorageService('biosur-fotos', 'us-east-1');
  const reporteFallaSvc =
    deps.reporteFallaService ?? new ReporteFallaService(pool, semaforoSvc, storageSvc);
  const ticketSvc = deps.ticketService ?? new TicketService(pool);
  const bloqueoSvc = deps.bloqueoService ?? new BloqueoService(pool);
  const hojaVidaSvc = deps.hojaVidaService ?? new HojaVidaService(pool);
  const biSvc = deps.biService ?? new BIService(pool);

  app.use('/api/auth', createAuthRouter(authSvc));
  app.use('/api/inspecciones', createInspeccionRouter(inspeccionSvc, authSvc, syncSvc));
  app.use('/api/reportes-falla', createReporteFallaRouter(reporteFallaSvc, authSvc));
  app.use('/api/tickets', createTicketRouter(ticketSvc, authSvc));
  app.use('/api/unidades', createUnidadRouter(bloqueoSvc, authSvc, hojaVidaSvc, pool));
  app.use('/api/dashboard', createDashboardRouter(biSvc, authSvc, pool));
  app.use('/api/asignaciones', createAsignacionRouter(pool, authSvc));

  return app;
}
