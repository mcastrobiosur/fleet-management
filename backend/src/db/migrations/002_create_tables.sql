-- Migration 002: Create all tables with constraints
-- Requerimientos: 11.1, 11.2

-- ============================================================
-- USUARIO
-- ============================================================
CREATE TABLE usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UNIDAD
-- ============================================================
CREATE TABLE unidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  patente VARCHAR(20) NOT NULL UNIQUE,
  anio INT NOT NULL,
  estado estado_unidad NOT NULL DEFAULT 'disponible',
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASIGNACION_CONDUCTOR
-- ============================================================
CREATE TABLE asignacion_conductor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES usuario(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  fecha_jornada DATE NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CODIGO_VERIFICACION
-- ============================================================
CREATE TABLE codigo_verificacion (
  id INT PRIMARY KEY CHECK (id BETWEEN 1 AND 39),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  nivel_riesgo nivel_riesgo NOT NULL
);

-- ============================================================
-- INSPECCION
-- ============================================================
CREATE TABLE inspeccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES usuario(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  timestamp_local TIMESTAMP NOT NULL,
  timestamp_servidor TIMESTAMP NOT NULL DEFAULT NOW(),
  creado_offline BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DETALLE_INSPECCION
-- ============================================================
CREATE TABLE detalle_inspeccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id UUID NOT NULL REFERENCES inspeccion(id) ON DELETE CASCADE,
  codigo_verificacion_id INT NOT NULL REFERENCES codigo_verificacion(id),
  valor INT NOT NULL CHECK (valor BETWEEN 0 AND 39)
);

-- ============================================================
-- REPORTE_FALLA
-- ============================================================
CREATE TABLE reporte_falla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id UUID NOT NULL REFERENCES inspeccion(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  codigo_verificacion_id INT NOT NULL REFERENCES codigo_verificacion(id),
  valor INT NOT NULL CHECK (valor BETWEEN 1 AND 39),
  descripcion TEXT NOT NULL,
  semaforo_riesgo nivel_riesgo NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FOTOGRAFIA
-- ============================================================
CREATE TABLE fotografia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_falla_id UUID NOT NULL REFERENCES reporte_falla(id) ON DELETE CASCADE,
  url_storage VARCHAR(500) NOT NULL,
  formato formato_foto NOT NULL,
  tamano_bytes INT NOT NULL CHECK (tamano_bytes > 0),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKET
-- ============================================================
CREATE TABLE ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_falla_id UUID NOT NULL REFERENCES reporte_falla(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  estado estado_ticket NOT NULL DEFAULT 'abierto',
  semaforo_riesgo nivel_riesgo NOT NULL,
  asignado_a UUID REFERENCES usuario(id),
  trabajo_realizado TEXT,
  validacion_reparacion TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HISTORIAL_TICKET
-- ============================================================
CREATE TABLE historial_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  estado_anterior estado_ticket NOT NULL,
  estado_nuevo estado_ticket NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  descripcion TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EVENTO_BLOQUEO
-- ============================================================
CREATE TABLE evento_bloqueo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  tipo tipo_bloqueo NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  razon TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOG_AUDITORIA
-- ============================================================
CREATE TABLE log_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  accion VARCHAR(100) NOT NULL,
  recurso VARCHAR(255) NOT NULL,
  codigo_http INT NOT NULL,
  detalles JSONB DEFAULT '{}',
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOG_SYNC_CONFLICTO
-- ============================================================
CREATE TABLE log_sync_conflicto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES usuario(id),
  tipo_operacion VARCHAR(100) NOT NULL,
  datos_locales JSONB NOT NULL DEFAULT '{}',
  datos_servidor JSONB NOT NULL DEFAULT '{}',
  razon TEXT NOT NULL,
  resuelto BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);
