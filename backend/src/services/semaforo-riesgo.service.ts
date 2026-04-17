import { Pool } from 'pg';
import { NivelRiesgo } from '@biosur/shared';

export class SemaforoRiesgoService {
  private clasificacionCache: Map<number, NivelRiesgo> | null = null;

  constructor(private pool: Pool) {}

  /**
   * Retorna el nivel de riesgo predefinido para un código de verificación (1-39).
   * Carga la clasificación desde la tabla `codigo_verificacion` en la primera llamada
   * y la cachea en memoria.
   */
  async clasificar(codigoVerificacionId: number): Promise<NivelRiesgo> {
    const clasificacion = await this.cargarClasificacion();
    const nivel = clasificacion.get(codigoVerificacionId);

    if (!nivel) {
      throw new Error(
        `Código de verificación no encontrado: ${codigoVerificacionId}`,
      );
    }

    return nivel;
  }

  /**
   * Retorna el mapa completo de clasificaciones (codigoId → NivelRiesgo).
   */
  async obtenerClasificacion(): Promise<Map<number, NivelRiesgo>> {
    return this.cargarClasificacion();
  }

  // --- Private helpers ---

  private async cargarClasificacion(): Promise<Map<number, NivelRiesgo>> {
    if (this.clasificacionCache) {
      return this.clasificacionCache;
    }

    const result = await this.pool.query<{
      id: number;
      nivel_riesgo: NivelRiesgo;
    }>('SELECT id, nivel_riesgo FROM codigo_verificacion ORDER BY id');

    const mapa = new Map<number, NivelRiesgo>();
    for (const row of result.rows) {
      mapa.set(row.id, row.nivel_riesgo as NivelRiesgo);
    }

    this.clasificacionCache = mapa;
    return mapa;
  }
}
