import { Pool } from 'pg';
import {
  CrearInspeccionDTO,
  SyncResult,
  ConflictoSync,
} from '@biosur/shared';
import { InspeccionService } from './inspeccion.service';

/** Backoff delays in ms for retry attempts (3 intentos: 1s, 5s, 30s) */
const BACKOFF_DELAYS = [1_000, 5_000, 30_000];

export interface SyncInspeccionItem {
  operacionId: string;
  datos: CrearInspeccionDTO;
}

export class SyncService {
  constructor(
    private pool: Pool,
    private inspeccionService: InspeccionService,
    private delayFn: (ms: number) => Promise<void> = defaultDelay,
  ) {}

  /**
   * Procesa un lote de inspecciones offline.
   * Para cada inspección:
   *  1. Intenta crearla con reintentos (backoff exponencial)
   *  2. Si detecta conflicto (misma unidad, mismo período), lo registra en log_sync_conflicto
   *  3. Retorna resumen con exitosos, fallidos y conflictos
   */
  async sincronizarLote(
    conductorId: string,
    items: SyncInspeccionItem[],
  ): Promise<SyncResult> {
    let exitosos = 0;
    let fallidos = 0;
    const conflictos: ConflictoSync[] = [];

    for (const item of items) {
      const result = await this.procesarItem(conductorId, item);

      if (result.tipo === 'exito') {
        exitosos++;
      } else if (result.tipo === 'conflicto') {
        conflictos.push(result.conflicto!);
      } else {
        fallidos++;
      }
    }

    return { exitosos, fallidos, conflictos };
  }

  private async procesarItem(
    conductorId: string,
    item: SyncInspeccionItem,
  ): Promise<{ tipo: 'exito' | 'conflicto' | 'fallo'; conflicto?: ConflictoSync }> {
    const dto: CrearInspeccionDTO = {
      ...item.datos,
      conductorId,
      creadoOffline: true,
      timestampLocal: new Date(item.datos.timestampLocal),
    };

    // Check for conflict before attempting creation
    const conflicto = await this.detectarConflicto(dto);
    if (conflicto) {
      await this.registrarConflicto(conductorId, item.operacionId, dto, conflicto);
      return {
        tipo: 'conflicto',
        conflicto: {
          operacionId: item.operacionId,
          razon: 'Inspección existente para la misma unidad en el mismo período',
          datosLocales: dto,
          datosServidor: conflicto,
        },
      };
    }

    // Attempt creation with exponential backoff
    for (let intento = 0; intento <= BACKOFF_DELAYS.length; intento++) {
      try {
        await this.inspeccionService.crear(dto);
        return { tipo: 'exito' };
      } catch (error) {
        const isLastAttempt = intento >= BACKOFF_DELAYS.length;
        if (isLastAttempt) {
          return { tipo: 'fallo' };
        }
        await this.delayFn(BACKOFF_DELAYS[intento]);
      }
    }

    return { tipo: 'fallo' };
  }

  /**
   * Detecta si ya existe una inspección para la misma unidad en el mismo día
   * (basado en timestamp_local).
   */
  private async detectarConflicto(
    dto: CrearInspeccionDTO,
  ): Promise<Record<string, unknown> | null> {
    const ts = new Date(dto.timestampLocal);
    const startOfDay = new Date(ts);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(ts);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.pool.query(
      `SELECT id, conductor_id, unidad_id, timestamp_local, timestamp_servidor, creado_offline, creado_en
       FROM inspeccion
       WHERE unidad_id = $1
         AND timestamp_local >= $2
         AND timestamp_local <= $3
       LIMIT 1`,
      [dto.unidadId, startOfDay, endOfDay],
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  }

  /**
   * Registra un conflicto de sincronización en log_sync_conflicto
   * y notifica al Administrador.
   */
  private async registrarConflicto(
    conductorId: string,
    operacionId: string,
    datosLocales: CrearInspeccionDTO,
    datosServidor: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO log_sync_conflicto
         (id, conductor_id, tipo_operacion, datos_locales, datos_servidor, razon, resuelto, creado_en)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())`,
      [
        conductorId,
        'inspeccion',
        JSON.stringify(datosLocales),
        JSON.stringify(datosServidor),
        `Conflicto: inspección existente para unidad ${datosLocales.unidadId} en el mismo período (operación ${operacionId})`,
      ],
    );
  }
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
