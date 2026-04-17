import { Pool } from 'pg';
import {
  EstadoUnidad,
  EstadoTicket,
  NivelRiesgo,
  TipoBloqueo,
  EventoBloqueo,
  Ticket,
} from '@biosur/shared';
import { ValidationError } from './inspeccion.service';

export class BloqueoError extends Error {
  public ticketsCriticos: Pick<Ticket, 'id' | 'estado' | 'semaforoRiesgo'>[];

  constructor(
    message: string,
    public statusCode: number,
    ticketsCriticos: Pick<Ticket, 'id' | 'estado' | 'semaforoRiesgo'>[],
  ) {
    super(message);
    this.name = 'BloqueoError';
    this.ticketsCriticos = ticketsCriticos;
  }
}

export class BloqueoService {
  constructor(private pool: Pool) {}

  /**
   * Returns true if the unit has active critical tickets (Abierto or EnProgreso).
   */
  async verificarBloqueo(unidadId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS count
       FROM ticket
       WHERE unidad_id = $1
         AND semaforo_riesgo = $2
         AND estado IN ($3, $4)`,
      [unidadId, NivelRiesgo.CRITICO, EstadoTicket.ABIERTO, EstadoTicket.EN_PROGRESO],
    );

    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Changes unit state with blocking rule validation.
   * Throws HTTP 409 if trying to set "disponible" while critical tickets are active.
   */
  async cambiarEstadoUnidad(
    unidadId: string,
    nuevoEstado: EstadoUnidad,
    userId: string,
  ): Promise<void> {
    if (nuevoEstado === EstadoUnidad.DISPONIBLE) {
      const ticketsCriticos = await this.obtenerTicketsCriticosActivos(unidadId);

      if (ticketsCriticos.length > 0) {
        await this.registrarEvento(
          unidadId,
          TipoBloqueo.BLOQUEO,
          userId,
          `Cambio a Disponible bloqueado: ${ticketsCriticos.length} ticket(s) crítico(s) activo(s)`,
        );

        throw new BloqueoError(
          'Unidad bloqueada por falla crítica',
          409,
          ticketsCriticos.map((t) => ({
            id: t.id,
            estado: t.estado,
            semaforoRiesgo: t.semaforoRiesgo,
          })),
        );
      }
    }

    await this.pool.query(
      `UPDATE unidad SET estado = $1 WHERE id = $2`,
      [nuevoEstado, unidadId],
    );

    if (nuevoEstado === EstadoUnidad.DISPONIBLE) {
      await this.registrarEvento(
        unidadId,
        TipoBloqueo.DESBLOQUEO,
        userId,
        'Unidad cambiada a Disponible',
      );
    }
  }

  /**
   * Checks if a conductor is allowed to start driving.
   * Throws HTTP 403 if the unit is blocked by critical failures.
   */
  async verificarMarchaPermitida(unidadId: string): Promise<void> {
    const ticketsCriticos = await this.obtenerTicketsCriticosActivos(unidadId);

    if (ticketsCriticos.length > 0) {
      throw new BloqueoError(
        'Unidad bloqueada',
        403,
        ticketsCriticos.map((t) => ({
          id: t.id,
          estado: t.estado,
          semaforoRiesgo: t.semaforoRiesgo,
        })),
      );
    }
  }

  /**
   * Logs a blocking/unblocking event to evento_bloqueo.
   */
  async registrarEvento(
    unidadId: string,
    tipo: TipoBloqueo,
    userId: string,
    razon: string,
  ): Promise<EventoBloqueo> {
    const result = await this.pool.query(
      `INSERT INTO evento_bloqueo (unidad_id, tipo, usuario_id, razon)
       VALUES ($1, $2, $3, $4)
       RETURNING id, unidad_id, tipo, usuario_id, razon, creado_en`,
      [unidadId, tipo, userId, razon],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      unidadId: row.unidad_id,
      tipo: row.tipo as TipoBloqueo,
      usuarioId: row.usuario_id,
      razon: row.razon,
      creadoEn: row.creado_en,
    };
  }

  // --- Private helpers ---

  private async obtenerTicketsCriticosActivos(
    unidadId: string,
  ): Promise<Pick<Ticket, 'id' | 'estado' | 'semaforoRiesgo'>[]> {
    const result = await this.pool.query(
      `SELECT id, estado, semaforo_riesgo
       FROM ticket
       WHERE unidad_id = $1
         AND semaforo_riesgo = $2
         AND estado IN ($3, $4)`,
      [unidadId, NivelRiesgo.CRITICO, EstadoTicket.ABIERTO, EstadoTicket.EN_PROGRESO],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      estado: row.estado as EstadoTicket,
      semaforoRiesgo: row.semaforo_riesgo as NivelRiesgo,
    }));
  }
}
