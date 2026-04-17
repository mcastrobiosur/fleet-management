import { SemaforoRiesgoService } from './semaforo-riesgo.service';
import { NivelRiesgo } from '@biosur/shared';

// --- Expected classification from seed data (001_codigos_verificacion.sql) ---
const SEED_CLASIFICACION: Array<{ id: number; nivel_riesgo: NivelRiesgo }> = [
  // Frenos (Crítico)
  { id: 1, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 2, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 3, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 4, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 5, nivel_riesgo: NivelRiesgo.CRITICO },
  // Neumáticos y suspensión
  { id: 6, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 7, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 8, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 9, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 10, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  // Dirección
  { id: 11, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 12, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  // Luces y señalización
  { id: 13, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 14, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 15, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 16, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 17, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 18, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  // Motor y fluidos (Preventivo)
  { id: 19, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 20, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 21, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 22, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 23, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 24, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  // Sistema eléctrico
  { id: 25, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 26, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 27, nivel_riesgo: NivelRiesgo.INFORMATIVO },
  { id: 28, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  // Seguridad pasiva (Crítico)
  { id: 29, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 30, nivel_riesgo: NivelRiesgo.CRITICO },
  { id: 31, nivel_riesgo: NivelRiesgo.CRITICO },
  // Carrocería y estructura
  { id: 32, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 33, nivel_riesgo: NivelRiesgo.INFORMATIVO },
  { id: 34, nivel_riesgo: NivelRiesgo.INFORMATIVO },
  // Equipamiento de emergencia
  { id: 35, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 36, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 37, nivel_riesgo: NivelRiesgo.PREVENTIVO },
  { id: 38, nivel_riesgo: NivelRiesgo.INFORMATIVO },
  // Documentación y limpieza
  { id: 39, nivel_riesgo: NivelRiesgo.INFORMATIVO },
];

// --- Mocks ---
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as any;

function buildDbRows() {
  return SEED_CLASIFICACION.map((c) => ({
    id: c.id,
    nivel_riesgo: c.nivel_riesgo,
  }));
}

describe('SemaforoRiesgoService', () => {
  let service: SemaforoRiesgoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SemaforoRiesgoService(mockPool);
  });

  // =========================================================
  // clasificar
  // =========================================================
  describe('clasificar', () => {
    it('should return CRITICO for brake system codes (1-5)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      for (const id of [1, 2, 3, 4, 5]) {
        const result = await service.clasificar(id);
        expect(result).toBe(NivelRiesgo.CRITICO);
      }
    });

    it('should return PREVENTIVO for preventive codes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      const preventiveCodes = [8, 9, 10, 12, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 32, 35, 36, 37];
      for (const id of preventiveCodes) {
        const result = await service.clasificar(id);
        expect(result).toBe(NivelRiesgo.PREVENTIVO);
      }
    });

    it('should return INFORMATIVO for informative codes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      const informativeCodes = [27, 33, 34, 38, 39];
      for (const id of informativeCodes) {
        const result = await service.clasificar(id);
        expect(result).toBe(NivelRiesgo.INFORMATIVO);
      }
    });

    it('should throw for non-existent code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      await expect(service.clasificar(0)).rejects.toThrow(
        'Código de verificación no encontrado: 0',
      );
    });

    it('should throw for code above 39', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      await expect(service.clasificar(40)).rejects.toThrow(
        'Código de verificación no encontrado: 40',
      );
    });

    it('should cache the classification after first load', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      await service.clasificar(1);
      await service.clasificar(2);
      await service.clasificar(39);

      // Only one DB query should have been made
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should query the codigo_verificacion table', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      await service.clasificar(1);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, nivel_riesgo FROM codigo_verificacion ORDER BY id',
      );
    });
  });

  // =========================================================
  // obtenerClasificacion
  // =========================================================
  describe('obtenerClasificacion', () => {
    it('should return a Map with all 39 codes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      const result = await service.obtenerClasificacion();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(39);
    });

    it('should contain correct classification for every code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      const result = await service.obtenerClasificacion();

      for (const expected of SEED_CLASIFICACION) {
        expect(result.get(expected.id)).toBe(expected.nivel_riesgo);
      }
    });

    it('should cache and reuse the same Map instance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      const first = await service.obtenerClasificacion();
      const second = await service.obtenerClasificacion();

      expect(first).toBe(second);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should share cache between clasificar and obtenerClasificacion', async () => {
      mockQuery.mockResolvedValueOnce({ rows: buildDbRows() });

      await service.clasificar(1);
      const mapa = await service.obtenerClasificacion();

      expect(mapa.size).toBe(39);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});
