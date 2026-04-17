import { BIService } from './bi.service';
import { FiltroPeriodo, EstadoUnidad } from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as any;

describe('BIService', () => {
  let service: BIService;
  const filtros: FiltroPeriodo = {
    desde: new Date('2024-01-01T00:00:00Z'),
    hasta: new Date('2024-06-30T23:59:59Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BIService(mockPool);
  });

  // =========================================================
  // calcularIndicadores
  // =========================================================
  describe('calcularIndicadores', () => {
    it('should calculate all indicators for a given period', async () => {
      // porcentajeOperativas query
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '3', total: '10' }],
      });
      // tiempoPromedioReparacion query
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: '24.5' }],
      });
      // frecuenciaFallas query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { unidad_id: 'u-1', cantidad: '5' },
          { unidad_id: 'u-2', cantidad: '2' },
        ],
      });

      const result = await service.calcularIndicadores(filtros);

      expect(result.porcentajeUnidadesOperativas).toBe(30);
      expect(result.tiempoPromedioReparacion).toBe(24.5);
      expect(result.frecuenciaFallasPorUnidad).toEqual({
        'u-1': 5,
        'u-2': 2,
      });
      expect(result.periodo).toBe(filtros);
    });

    it('should return 0% when there are no units', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '0', total: '0' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.calcularIndicadores(filtros);

      expect(result.porcentajeUnidadesOperativas).toBe(0);
    });

    it('should return 100% when all units are operativas', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '5', total: '5' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: '10' }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.calcularIndicadores(filtros);

      expect(result.porcentajeUnidadesOperativas).toBe(100);
    });

    it('should return 0 for tiempoPromedio when no closed tickets exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '2', total: '4' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.calcularIndicadores(filtros);

      expect(result.tiempoPromedioReparacion).toBe(0);
    });

    it('should return empty frecuencia when no fallas in period', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '1', total: '1' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.calcularIndicadores(filtros);

      expect(result.frecuenciaFallasPorUnidad).toEqual({});
    });

    it('should pass correct filter dates to queries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '1', total: '1' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.calcularIndicadores(filtros);

      // porcentajeOperativas uses EstadoUnidad.OPERATIVA
      expect(mockQuery.mock.calls[0][1]).toEqual([EstadoUnidad.OPERATIVA]);

      // tiempoPromedio uses desde/hasta
      expect(mockQuery.mock.calls[1][1]).toEqual([filtros.desde, filtros.hasta]);

      // frecuenciaFallas uses desde/hasta
      expect(mockQuery.mock.calls[2][1]).toEqual([filtros.desde, filtros.hasta]);
    });
  });

  // =========================================================
  // exportarCSV
  // =========================================================
  describe('exportarCSV', () => {
    it('should generate a valid CSV with headers and data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '3', total: '10' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: '12.5' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { unidad_id: 'u-1', cantidad: '4' },
          { unidad_id: 'u-2', cantidad: '1' },
        ],
      });

      const buffer = await service.exportarCSV(filtros);
      const csv = buffer.toString('utf-8');
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Indicador,Valor');
      expect(lines[1]).toBe('Porcentaje Unidades Operativas,30');
      expect(lines[2]).toBe('Tiempo Promedio Reparacion (horas),12.5');
      expect(lines[3]).toContain('Periodo Desde,');
      expect(lines[3]).toContain('2024-01-01');
      expect(lines[4]).toContain('Periodo Hasta,');
      expect(lines[4]).toContain('2024-06-30');
      // Blank separator line
      expect(lines[5]).toBe('');
      expect(lines[6]).toBe('Unidad ID,Frecuencia Fallas');
      expect(lines[7]).toBe('u-1,4');
      expect(lines[8]).toBe('u-2,1');
    });

    it('should return a Buffer', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '0', total: '0' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.exportarCSV(filtros);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle empty frecuencia gracefully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ operativas: '0', total: '0' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ promedio_horas: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const buffer = await service.exportarCSV(filtros);
      const csv = buffer.toString('utf-8');
      const lines = csv.split('\n');

      // Should still have the frequency header but no data rows after it
      expect(lines[6]).toBe('Unidad ID,Frecuencia Fallas');
      expect(lines.length).toBe(7);
    });
  });
});
