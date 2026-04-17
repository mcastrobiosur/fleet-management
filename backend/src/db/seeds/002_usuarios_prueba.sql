-- Seed 002: Usuarios de prueba para desarrollo
-- Contraseña para todos: "biosur123" (hash bcrypt)
-- Hash generado con bcrypt.hashSync('biosur123', 10)

-- Administrador
INSERT INTO usuario (id, email, password_hash, rol, nombre, activo) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@biosur.cl', '$2b$10$8KzaNdKIMyOkASCBkeAdleDNrMJkEL0JHDesqBfiAqSMsZm8YCbHy', 'administrador', 'Carlos Mendoza', true);

-- Conductores
INSERT INTO usuario (id, email, password_hash, rol, nombre, activo) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'conductor1@biosur.cl', '$2b$10$8KzaNdKIMyOkASCBkeAdleDNrMJkEL0JHDesqBfiAqSMsZm8YCbHy', 'conductor', 'Juan Pérez', true),
  ('c0000000-0000-0000-0000-000000000002', 'conductor2@biosur.cl', '$2b$10$8KzaNdKIMyOkASCBkeAdleDNrMJkEL0JHDesqBfiAqSMsZm8YCbHy', 'conductor', 'María González', true);

-- Equipo de Mantenimiento
INSERT INTO usuario (id, email, password_hash, rol, nombre, activo) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'mant1@biosur.cl', '$2b$10$8KzaNdKIMyOkASCBkeAdleDNrMJkEL0JHDesqBfiAqSMsZm8YCbHy', 'equipo_mantenimiento', 'Roberto Silva', true),
  ('e0000000-0000-0000-0000-000000000002', 'mant2@biosur.cl', '$2b$10$8KzaNdKIMyOkASCBkeAdleDNrMJkEL0JHDesqBfiAqSMsZm8YCbHy', 'equipo_mantenimiento', 'Ana Torres', true);

-- Unidades de flota
INSERT INTO unidad (id, marca, modelo, patente, anio, estado) VALUES
  ('u0000000-0000-0000-0000-000000000001', 'Mercedes-Benz', 'Sprinter 516', 'ABCD-12', 2022, 'operativa'),
  ('u0000000-0000-0000-0000-000000000002', 'Ford', 'Transit 350', 'EFGH-34', 2021, 'operativa'),
  ('u0000000-0000-0000-0000-000000000003', 'Toyota', 'Hilux DX', 'IJKL-56', 2023, 'disponible'),
  ('u0000000-0000-0000-0000-000000000004', 'Volkswagen', 'Crafter', 'MNOP-78', 2020, 'en_mantenimiento'),
  ('u0000000-0000-0000-0000-000000000005', 'Hyundai', 'HD78', 'QRST-90', 2022, 'operativa');

-- Asignaciones de conductores para hoy
INSERT INTO asignacion_conductor (conductor_id, unidad_id, fecha_jornada) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', CURRENT_DATE),
  ('c0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000002', CURRENT_DATE);
