-- Migration 001: Create custom ENUM types
-- Requerimientos: 11.1

CREATE TYPE rol_usuario AS ENUM ('conductor', 'administrador', 'equipo_mantenimiento');
CREATE TYPE estado_unidad AS ENUM ('disponible', 'bloqueada', 'en_mantenimiento', 'operativa');
CREATE TYPE nivel_riesgo AS ENUM ('critico', 'preventivo', 'informativo');
CREATE TYPE estado_ticket AS ENUM ('abierto', 'en_progreso', 'cerrado');
CREATE TYPE tipo_bloqueo AS ENUM ('bloqueo', 'desbloqueo');
CREATE TYPE formato_foto AS ENUM ('jpeg', 'png');
