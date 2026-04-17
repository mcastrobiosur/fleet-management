-- ============================================================
-- Biosur Fleet Management — Schema completo + seed base
-- Ejecutar: psql -U biosur -d biosur -f init.sql
-- O desde docker: docker exec -i <postgres-container> psql -U biosur -d biosur < init.sql
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE rol_usuario AS ENUM ('conductor', 'administrador', 'equipo_mantenimiento');
CREATE TYPE estado_unidad AS ENUM ('disponible', 'bloqueada', 'en_mantenimiento', 'operativa');
CREATE TYPE nivel_riesgo AS ENUM ('critico', 'preventivo', 'informativo');
CREATE TYPE estado_ticket AS ENUM ('abierto', 'en_progreso', 'cerrado');
CREATE TYPE tipo_bloqueo AS ENUM ('bloqueo', 'desbloqueo');
CREATE TYPE formato_foto AS ENUM ('jpeg', 'png');

-- ============================================================
-- TABLAS
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

CREATE TABLE unidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  patente VARCHAR(20) NOT NULL UNIQUE,
  anio INT NOT NULL,
  estado estado_unidad NOT NULL DEFAULT 'disponible',
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE asignacion_conductor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES usuario(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  fecha_jornada DATE NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE codigo_verificacion (
  id INT PRIMARY KEY CHECK (id BETWEEN 1 AND 39),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  nivel_riesgo nivel_riesgo NOT NULL
);

CREATE TABLE inspeccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES usuario(id),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  timestamp_local TIMESTAMP NOT NULL,
  timestamp_servidor TIMESTAMP NOT NULL DEFAULT NOW(),
  creado_offline BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE detalle_inspeccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id UUID NOT NULL REFERENCES inspeccion(id) ON DELETE CASCADE,
  codigo_verificacion_id INT NOT NULL REFERENCES codigo_verificacion(id),
  valor INT NOT NULL CHECK (valor BETWEEN 0 AND 39)
);

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

CREATE TABLE fotografia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_falla_id UUID NOT NULL REFERENCES reporte_falla(id) ON DELETE CASCADE,
  url_storage VARCHAR(500) NOT NULL,
  formato formato_foto NOT NULL,
  tamano_bytes INT NOT NULL CHECK (tamano_bytes > 0),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

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

CREATE TABLE historial_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  estado_anterior estado_ticket NOT NULL,
  estado_nuevo estado_ticket NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  descripcion TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE evento_bloqueo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidad(id),
  tipo tipo_bloqueo NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  razon TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE log_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario(id),
  accion VARCHAR(100) NOT NULL,
  recurso VARCHAR(255) NOT NULL,
  codigo_http INT NOT NULL,
  detalles JSONB DEFAULT '{}',
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

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

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_inspeccion_unidad_fecha    ON inspeccion(unidad_id, creado_en DESC);
CREATE INDEX idx_reporte_falla_unidad       ON reporte_falla(unidad_id, creado_en DESC);
CREATE INDEX idx_reporte_falla_semaforo     ON reporte_falla(semaforo_riesgo);
CREATE INDEX idx_ticket_unidad_estado       ON ticket(unidad_id, estado);
CREATE INDEX idx_ticket_asignado            ON ticket(asignado_a, estado);
CREATE INDEX idx_evento_bloqueo_unidad      ON evento_bloqueo(unidad_id, creado_en DESC);
CREATE INDEX idx_asignacion_conductor_fecha ON asignacion_conductor(conductor_id, fecha_jornada);

-- ============================================================
-- SEED: 39 códigos de verificación
-- ============================================================
INSERT INTO codigo_verificacion (id, nombre, descripcion, nivel_riesgo) VALUES
(1,  'Freno de servicio',             'Estado y funcionamiento del freno de servicio principal',                      'critico'),
(2,  'Freno de estacionamiento',      'Estado y funcionamiento del freno de mano/estacionamiento',                    'critico'),
(3,  'Líquido de frenos',             'Nivel y estado del líquido de frenos',                                         'critico'),
(4,  'Pastillas de freno',            'Desgaste de pastillas/balatas de freno delanteras y traseras',                 'critico'),
(5,  'Discos de freno',               'Estado de discos de freno, verificar deformación o desgaste excesivo',         'critico'),
(6,  'Neumáticos delanteros',         'Profundidad de banda de rodamiento y estado general de neumáticos delanteros', 'critico'),
(7,  'Neumáticos traseros',           'Profundidad de banda de rodamiento y estado general de neumáticos traseros',   'critico'),
(8,  'Neumático de repuesto',         'Presencia y estado del neumático de repuesto',                                 'preventivo'),
(9,  'Presión de neumáticos',         'Verificar presión de inflado según especificación del fabricante',              'preventivo'),
(10, 'Amortiguadores',                'Estado de amortiguadores, verificar fugas o desgaste',                         'preventivo'),
(11, 'Dirección',                     'Juego y respuesta del sistema de dirección',                                   'critico'),
(12, 'Líquido de dirección',          'Nivel de líquido de dirección hidráulica',                                     'preventivo'),
(13, 'Luces delanteras',              'Funcionamiento de luces bajas y altas',                                        'critico'),
(14, 'Luces traseras',                'Funcionamiento de luces traseras y de freno',                                  'critico'),
(15, 'Luces de giro',                 'Funcionamiento de intermitentes delanteros y traseros',                        'critico'),
(16, 'Luces de emergencia',           'Funcionamiento de balizas/luces de emergencia',                                'critico'),
(17, 'Luces de retroceso',            'Funcionamiento de luces de marcha atrás',                                      'preventivo'),
(18, 'Luces de patente',              'Funcionamiento de luces iluminadoras de placa patente',                        'preventivo'),
(19, 'Nivel de aceite motor',         'Verificar nivel de aceite del motor según varilla',                            'preventivo'),
(20, 'Nivel de refrigerante',         'Verificar nivel de líquido refrigerante en depósito',                          'preventivo'),
(21, 'Correas del motor',             'Estado de correas de distribución y accesorios',                               'preventivo'),
(22, 'Filtro de aire',                'Estado del filtro de aire del motor',                                          'preventivo'),
(23, 'Sistema de escape',             'Estado del tubo de escape, silenciador y catalizador',                         'preventivo'),
(24, 'Batería',                       'Estado de bornes, carga y fijación de la batería',                            'preventivo'),
(25, 'Bocina',                        'Funcionamiento de la bocina/claxon',                                          'preventivo'),
(26, 'Limpiaparabrisas',              'Funcionamiento y estado de escobillas limpiaparabrisas',                       'preventivo'),
(27, 'Líquido limpiaparabrisas',      'Nivel de líquido del sistema limpiaparabrisas',                                'informativo'),
(28, 'Tablero de instrumentos',       'Funcionamiento de indicadores y testigos del tablero',                         'preventivo'),
(29, 'Cinturones de seguridad',       'Estado y funcionamiento de cinturones de seguridad',                           'critico'),
(30, 'Espejos retrovisores',          'Estado y ajuste de espejos retrovisores internos y externos',                  'critico'),
(31, 'Parabrisas',                    'Estado del parabrisas, verificar fisuras o daños que afecten visibilidad',     'critico'),
(32, 'Puertas y cerraduras',          'Funcionamiento de puertas, cerraduras y manijas',                              'preventivo'),
(33, 'Ventanas',                      'Funcionamiento de vidrios eléctricos o manuales',                              'informativo'),
(34, 'Carrocería exterior',           'Estado general de la carrocería, abolladuras o daños visibles',                'informativo'),
(35, 'Extintor',                      'Presencia, vigencia y accesibilidad del extintor',                             'preventivo'),
(36, 'Triángulos de seguridad',       'Presencia y estado de triángulos reflectivos de emergencia',                   'preventivo'),
(37, 'Botiquín de primeros auxilios', 'Presencia y contenido del botiquín de primeros auxilios',                      'preventivo'),
(38, 'Chaleco reflectivo',            'Presencia de chaleco reflectivo de seguridad',                                 'informativo'),
(39, 'Limpieza general',              'Estado de limpieza interior y exterior del vehículo',                          'informativo');
