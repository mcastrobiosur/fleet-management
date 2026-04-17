export { ALL_TABLES, CREATE_PENDING_INSPECCIONES_TABLE, CREATE_PENDING_REPORTES_TABLE } from './schema';
export {
  initDatabase,
  getDatabase,
  insertPendingInspeccion,
  getPendingInspecciones,
  markInspeccionSynced,
  insertPendingReporte,
  getPendingReportes,
  markReporteSynced,
} from './database';
export type { PendingInspeccion, PendingReporte } from './database';
