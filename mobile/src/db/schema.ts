/**
 * Esquema SQLite local para almacenamiento offline.
 *
 * Tablas:
 * - pending_inspecciones: inspecciones creadas offline pendientes de sincronización
 * - pending_reportes: reportes de falla creados offline pendientes de sincronización
 */

export const CREATE_PENDING_INSPECCIONES_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_inspecciones (
    id TEXT PRIMARY KEY,
    datos TEXT NOT NULL,
    timestamp_local TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );
`;

export const CREATE_PENDING_REPORTES_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_reportes (
    id TEXT PRIMARY KEY,
    datos TEXT NOT NULL,
    timestamp_local TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );
`;

/** Todas las sentencias DDL necesarias para inicializar la base de datos local. */
export const ALL_TABLES = [
  CREATE_PENDING_INSPECCIONES_TABLE,
  CREATE_PENDING_REPORTES_TABLE,
] as const;
