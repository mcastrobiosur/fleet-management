-- Seed 001: 39 códigos de verificación para inspección vehicular
-- Requerimientos: 5.1
-- Cada código tiene un nivel_riesgo asignado según su impacto en la seguridad operativa

INSERT INTO codigo_verificacion (id, nombre, descripcion, nivel_riesgo) VALUES
-- === SISTEMA DE FRENOS (Crítico) ===
(1,  'Freno de servicio',           'Estado y funcionamiento del freno de servicio principal',                    'critico'),
(2,  'Freno de estacionamiento',    'Estado y funcionamiento del freno de mano/estacionamiento',                  'critico'),
(3,  'Líquido de frenos',           'Nivel y estado del líquido de frenos',                                       'critico'),
(4,  'Pastillas de freno',          'Desgaste de pastillas/balatas de freno delanteras y traseras',               'critico'),
(5,  'Discos de freno',             'Estado de discos de freno, verificar deformación o desgaste excesivo',       'critico'),

-- === NEUMÁTICOS Y SUSPENSIÓN (Crítico) ===
(6,  'Neumáticos delanteros',       'Profundidad de banda de rodamiento y estado general de neumáticos delanteros', 'critico'),
(7,  'Neumáticos traseros',         'Profundidad de banda de rodamiento y estado general de neumáticos traseros',   'critico'),
(8,  'Neumático de repuesto',       'Presencia y estado del neumático de repuesto',                                 'preventivo'),
(9,  'Presión de neumáticos',       'Verificar presión de inflado según especificación del fabricante',              'preventivo'),
(10, 'Amortiguadores',              'Estado de amortiguadores, verificar fugas o desgaste',                          'preventivo'),

-- === SISTEMA DE DIRECCIÓN (Crítico) ===
(11, 'Dirección',                   'Juego y respuesta del sistema de dirección',                                  'critico'),
(12, 'Líquido de dirección',        'Nivel de líquido de dirección hidráulica',                                    'preventivo'),

-- === LUCES Y SEÑALIZACIÓN (Crítico/Preventivo) ===
(13, 'Luces delanteras',            'Funcionamiento de luces bajas y altas',                                       'critico'),
(14, 'Luces traseras',              'Funcionamiento de luces traseras y de freno',                                 'critico'),
(15, 'Luces de giro',               'Funcionamiento de intermitentes delanteros y traseros',                       'critico'),
(16, 'Luces de emergencia',         'Funcionamiento de balizas/luces de emergencia',                               'critico'),
(17, 'Luces de retroceso',          'Funcionamiento de luces de marcha atrás',                                     'preventivo'),
(18, 'Luces de patente',            'Funcionamiento de luces iluminadoras de placa patente',                       'preventivo'),

-- === MOTOR Y FLUIDOS (Preventivo) ===
(19, 'Nivel de aceite motor',       'Verificar nivel de aceite del motor según varilla',                           'preventivo'),
(20, 'Nivel de refrigerante',       'Verificar nivel de líquido refrigerante en depósito',                         'preventivo'),
(21, 'Correas del motor',           'Estado de correas de distribución y accesorios',                              'preventivo'),
(22, 'Filtro de aire',              'Estado del filtro de aire del motor',                                         'preventivo'),
(23, 'Sistema de escape',           'Estado del tubo de escape, silenciador y catalizador',                        'preventivo'),
(24, 'Batería',                     'Estado de bornes, carga y fijación de la batería',                            'preventivo'),

-- === SISTEMA ELÉCTRICO (Preventivo) ===
(25, 'Bocina',                      'Funcionamiento de la bocina/claxon',                                          'preventivo'),
(26, 'Limpiaparabrisas',            'Funcionamiento y estado de escobillas limpiaparabrisas',                      'preventivo'),
(27, 'Líquido limpiaparabrisas',    'Nivel de líquido del sistema limpiaparabrisas',                               'informativo'),
(28, 'Tablero de instrumentos',     'Funcionamiento de indicadores y testigos del tablero',                        'preventivo'),

-- === SEGURIDAD PASIVA (Crítico) ===
(29, 'Cinturones de seguridad',     'Estado y funcionamiento de cinturones de seguridad',                          'critico'),
(30, 'Espejos retrovisores',        'Estado y ajuste de espejos retrovisores internos y externos',                 'critico'),
(31, 'Parabrisas',                  'Estado del parabrisas, verificar fisuras o daños que afecten visibilidad',    'critico'),

-- === CARROCERÍA Y ESTRUCTURA (Preventivo/Informativo) ===
(32, 'Puertas y cerraduras',        'Funcionamiento de puertas, cerraduras y manijas',                             'preventivo'),
(33, 'Ventanas',                    'Funcionamiento de vidrios eléctricos o manuales',                             'informativo'),
(34, 'Carrocería exterior',         'Estado general de la carrocería, abolladuras o daños visibles',               'informativo'),

-- === EQUIPAMIENTO DE EMERGENCIA (Preventivo) ===
(35, 'Extintor',                    'Presencia, vigencia y accesibilidad del extintor',                            'preventivo'),
(36, 'Triángulos de seguridad',     'Presencia y estado de triángulos reflectivos de emergencia',                  'preventivo'),
(37, 'Botiquín de primeros auxilios','Presencia y contenido del botiquín de primeros auxilios',                    'preventivo'),
(38, 'Chaleco reflectivo',          'Presencia de chaleco reflectivo de seguridad',                                'informativo'),

-- === DOCUMENTACIÓN Y LIMPIEZA (Informativo) ===
(39, 'Limpieza general',            'Estado de limpieza interior y exterior del vehículo',                         'informativo');
