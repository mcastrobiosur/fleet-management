// Tipos de servicios — Hoja de Vida, BI, Sync

import {
  Unidad,
  Inspeccion,
  ReporteFalla,
  Ticket,
  EventoBloqueo,
} from './entities';
import { FiltroPeriodo } from './filters';

// Hoja de Vida
export interface HojaVida {
  unidad: Unidad;
  inspecciones: Inspeccion[];
  reportesFalla: ReporteFalla[];
  tickets: Ticket[];
  eventosBloqueDesbloqueo: EventoBloqueo[];
}

export type TipoEventoHojaVida = 'inspeccion' | 'reporte_falla' | 'ticket' | 'bloqueo';

export interface EventoHojaVida {
  tipo: TipoEventoHojaVida;
  referenciaId: string;
  descripcion: string;
}

// Indicadores BI
export interface IndicadoresFlota {
  porcentajeUnidadesOperativas: number;
  tiempoPromedioReparacion: number; // en horas
  frecuenciaFallasPorUnidad: Record<string, number>;
  periodo: FiltroPeriodo;
}

// Sincronización offline
export interface OperacionPendiente {
  id: string;
  tipo: 'inspeccion' | 'reporte_falla';
  datos: unknown;
  timestampLocal: Date;
  intentos: number;
}

export interface SyncResult {
  exitosos: number;
  fallidos: number;
  conflictos: ConflictoSync[];
}

export interface ConflictoSync {
  operacionId: string;
  razon: string;
  datosLocales: unknown;
  datosServidor: unknown;
}
