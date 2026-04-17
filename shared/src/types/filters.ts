// Tipos de filtros — Sistema de Gestión de Flota Biosur

import { NivelRiesgo, EstadoTicket } from './enums';

export interface FiltroFecha {
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface FiltroSemaforo extends FiltroFecha {
  semaforo?: NivelRiesgo;
}

export interface FiltroHojaVida {
  fechaDesde?: Date;
  fechaHasta?: Date;
  tipoFalla?: number;
  estadoTicket?: EstadoTicket;
}

export interface FiltroPeriodo {
  desde: Date;
  hasta: Date;
}
