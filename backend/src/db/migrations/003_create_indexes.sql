-- Migration 003: Create recommended indexes for query performance
-- Requerimientos: 11.1

-- Inspecciones por unidad y fecha (Hoja de Vida, consultas frecuentes)
CREATE INDEX idx_inspeccion_unidad_fecha ON inspeccion(unidad_id, creado_en DESC);

-- Reportes de falla por unidad (Hoja de Vida)
CREATE INDEX idx_reporte_falla_unidad ON reporte_falla(unidad_id, creado_en DESC);

-- Reportes de falla por semáforo (filtrado por criticidad)
CREATE INDEX idx_reporte_falla_semaforo ON reporte_falla(semaforo_riesgo);

-- Tickets por unidad y estado (estado de flota, bloqueo de seguridad)
CREATE INDEX idx_ticket_unidad_estado ON ticket(unidad_id, estado);

-- Tickets por asignado y estado (vista equipo mantenimiento)
CREATE INDEX idx_ticket_asignado ON ticket(asignado_a, estado);

-- Eventos de bloqueo por unidad (Hoja de Vida)
CREATE INDEX idx_evento_bloqueo_unidad ON evento_bloqueo(unidad_id, creado_en DESC);

-- Asignaciones de conductor por fecha (login y vinculación)
CREATE INDEX idx_asignacion_conductor_fecha ON asignacion_conductor(conductor_id, fecha_jornada);
