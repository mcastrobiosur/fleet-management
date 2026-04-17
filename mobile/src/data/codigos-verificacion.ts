/**
 * 39 códigos de verificación para inspección vehicular.
 * Datos derivados del seed 001_codigos_verificacion.sql.
 *
 * Requerimientos: 5.1, 2.1
 */

import { NivelRiesgo } from '@biosur/shared';

export interface CodigoVerificacion {
  id: number;
  nombre: string;
  descripcion: string;
  nivelRiesgo: NivelRiesgo;
  categoria: string;
}

export const CODIGOS_VERIFICACION: CodigoVerificacion[] = [
  // === SISTEMA DE FRENOS (Crítico) ===
  { id: 1,  nombre: 'Freno de servicio',        descripcion: 'Estado y funcionamiento del freno de servicio principal',                    nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Frenos' },
  { id: 2,  nombre: 'Freno de estacionamiento',  descripcion: 'Estado y funcionamiento del freno de mano/estacionamiento',                  nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Frenos' },
  { id: 3,  nombre: 'Líquido de frenos',         descripcion: 'Nivel y estado del líquido de frenos',                                       nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Frenos' },
  { id: 4,  nombre: 'Pastillas de freno',        descripcion: 'Desgaste de pastillas/balatas de freno delanteras y traseras',               nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Frenos' },
  { id: 5,  nombre: 'Discos de freno',           descripcion: 'Estado de discos de freno, verificar deformación o desgaste excesivo',       nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Frenos' },

  // === NEUMÁTICOS Y SUSPENSIÓN ===
  { id: 6,  nombre: 'Neumáticos delanteros',     descripcion: 'Profundidad de banda de rodamiento y estado general de neumáticos delanteros', nivelRiesgo: NivelRiesgo.CRITICO,   categoria: 'Neumáticos y Suspensión' },
  { id: 7,  nombre: 'Neumáticos traseros',       descripcion: 'Profundidad de banda de rodamiento y estado general de neumáticos traseros',   nivelRiesgo: NivelRiesgo.CRITICO,   categoria: 'Neumáticos y Suspensión' },
  { id: 8,  nombre: 'Neumático de repuesto',     descripcion: 'Presencia y estado del neumático de repuesto',                                 nivelRiesgo: NivelRiesgo.PREVENTIVO, categoria: 'Neumáticos y Suspensión' },
  { id: 9,  nombre: 'Presión de neumáticos',     descripcion: 'Verificar presión de inflado según especificación del fabricante',              nivelRiesgo: NivelRiesgo.PREVENTIVO, categoria: 'Neumáticos y Suspensión' },
  { id: 10, nombre: 'Amortiguadores',            descripcion: 'Estado de amortiguadores, verificar fugas o desgaste',                          nivelRiesgo: NivelRiesgo.PREVENTIVO, categoria: 'Neumáticos y Suspensión' },

  // === SISTEMA DE DIRECCIÓN ===
  { id: 11, nombre: 'Dirección',                 descripcion: 'Juego y respuesta del sistema de dirección',                                  nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Sistema de Dirección' },
  { id: 12, nombre: 'Líquido de dirección',      descripcion: 'Nivel de líquido de dirección hidráulica',                                    nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Sistema de Dirección' },

  // === LUCES Y SEÑALIZACIÓN ===
  { id: 13, nombre: 'Luces delanteras',          descripcion: 'Funcionamiento de luces bajas y altas',                                       nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Luces y Señalización' },
  { id: 14, nombre: 'Luces traseras',            descripcion: 'Funcionamiento de luces traseras y de freno',                                 nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Luces y Señalización' },
  { id: 15, nombre: 'Luces de giro',             descripcion: 'Funcionamiento de intermitentes delanteros y traseros',                       nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Luces y Señalización' },
  { id: 16, nombre: 'Luces de emergencia',       descripcion: 'Funcionamiento de balizas/luces de emergencia',                               nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Luces y Señalización' },
  { id: 17, nombre: 'Luces de retroceso',        descripcion: 'Funcionamiento de luces de marcha atrás',                                     nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Luces y Señalización' },
  { id: 18, nombre: 'Luces de patente',          descripcion: 'Funcionamiento de luces iluminadoras de placa patente',                       nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Luces y Señalización' },

  // === MOTOR Y FLUIDOS ===
  { id: 19, nombre: 'Nivel de aceite motor',     descripcion: 'Verificar nivel de aceite del motor según varilla',                           nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },
  { id: 20, nombre: 'Nivel de refrigerante',     descripcion: 'Verificar nivel de líquido refrigerante en depósito',                         nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },
  { id: 21, nombre: 'Correas del motor',         descripcion: 'Estado de correas de distribución y accesorios',                              nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },
  { id: 22, nombre: 'Filtro de aire',            descripcion: 'Estado del filtro de aire del motor',                                         nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },
  { id: 23, nombre: 'Sistema de escape',         descripcion: 'Estado del tubo de escape, silenciador y catalizador',                        nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },
  { id: 24, nombre: 'Batería',                   descripcion: 'Estado de bornes, carga y fijación de la batería',                            nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Motor y Fluidos' },

  // === SISTEMA ELÉCTRICO ===
  { id: 25, nombre: 'Bocina',                    descripcion: 'Funcionamiento de la bocina/claxon',                                          nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Sistema Eléctrico' },
  { id: 26, nombre: 'Limpiaparabrisas',          descripcion: 'Funcionamiento y estado de escobillas limpiaparabrisas',                      nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Sistema Eléctrico' },
  { id: 27, nombre: 'Líquido limpiaparabrisas',  descripcion: 'Nivel de líquido del sistema limpiaparabrisas',                               nivelRiesgo: NivelRiesgo.INFORMATIVO, categoria: 'Sistema Eléctrico' },
  { id: 28, nombre: 'Tablero de instrumentos',   descripcion: 'Funcionamiento de indicadores y testigos del tablero',                        nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Sistema Eléctrico' },

  // === SEGURIDAD PASIVA ===
  { id: 29, nombre: 'Cinturones de seguridad',   descripcion: 'Estado y funcionamiento de cinturones de seguridad',                          nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Seguridad Pasiva' },
  { id: 30, nombre: 'Espejos retrovisores',      descripcion: 'Estado y ajuste de espejos retrovisores internos y externos',                 nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Seguridad Pasiva' },
  { id: 31, nombre: 'Parabrisas',                descripcion: 'Estado del parabrisas, verificar fisuras o daños que afecten visibilidad',    nivelRiesgo: NivelRiesgo.CRITICO,     categoria: 'Seguridad Pasiva' },

  // === CARROCERÍA Y ESTRUCTURA ===
  { id: 32, nombre: 'Puertas y cerraduras',      descripcion: 'Funcionamiento de puertas, cerraduras y manijas',                             nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Carrocería y Estructura' },
  { id: 33, nombre: 'Ventanas',                  descripcion: 'Funcionamiento de vidrios eléctricos o manuales',                             nivelRiesgo: NivelRiesgo.INFORMATIVO, categoria: 'Carrocería y Estructura' },
  { id: 34, nombre: 'Carrocería exterior',       descripcion: 'Estado general de la carrocería, abolladuras o daños visibles',               nivelRiesgo: NivelRiesgo.INFORMATIVO, categoria: 'Carrocería y Estructura' },

  // === EQUIPAMIENTO DE EMERGENCIA ===
  { id: 35, nombre: 'Extintor',                  descripcion: 'Presencia, vigencia y accesibilidad del extintor',                            nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Equipamiento de Emergencia' },
  { id: 36, nombre: 'Triángulos de seguridad',   descripcion: 'Presencia y estado de triángulos reflectivos de emergencia',                  nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Equipamiento de Emergencia' },
  { id: 37, nombre: 'Botiquín de primeros auxilios', descripcion: 'Presencia y contenido del botiquín de primeros auxilios',                 nivelRiesgo: NivelRiesgo.PREVENTIVO,  categoria: 'Equipamiento de Emergencia' },
  { id: 38, nombre: 'Chaleco reflectivo',        descripcion: 'Presencia de chaleco reflectivo de seguridad',                                nivelRiesgo: NivelRiesgo.INFORMATIVO, categoria: 'Equipamiento de Emergencia' },

  // === DOCUMENTACIÓN Y LIMPIEZA ===
  { id: 39, nombre: 'Limpieza general',          descripcion: 'Estado de limpieza interior y exterior del vehículo',                         nivelRiesgo: NivelRiesgo.INFORMATIVO, categoria: 'Documentación y Limpieza' },
];

/** Map for O(1) lookup by code ID */
export const CODIGOS_MAP = new Map(
  CODIGOS_VERIFICACION.map((c) => [c.id, c]),
);

/** Unique categories in display order */
export const CATEGORIAS = [
  ...new Set(CODIGOS_VERIFICACION.map((c) => c.categoria)),
];

/** Color mapping for risk-level semaphore */
export const SEMAFORO_COLORS: Record<NivelRiesgo, string> = {
  [NivelRiesgo.CRITICO]: '#ba1a1a',     // Rojo
  [NivelRiesgo.PREVENTIVO]: '#e8a317',   // Amarillo/Ámbar
  [NivelRiesgo.INFORMATIVO]: '#659833',  // Verde
};

/** Label mapping for risk levels */
export const SEMAFORO_LABELS: Record<NivelRiesgo, string> = {
  [NivelRiesgo.CRITICO]: 'Crítico',
  [NivelRiesgo.PREVENTIVO]: 'Preventivo',
  [NivelRiesgo.INFORMATIVO]: 'Informativo',
};
