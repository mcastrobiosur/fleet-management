# Plan de Implementación: Sistema de Digitalización y Gestión de Flota Biosur

## Visión General

Implementación incremental del sistema de gestión de flota, comenzando por la capa de datos y servicios core del backend, seguido por los módulos de negocio (inspecciones, fallas, tickets, semáforo), luego la sincronización offline y notificaciones, y finalmente el Dashboard y módulo BI. Cada fase se valida con tests antes de avanzar.

## Tareas

- [x] 1. Configuración del proyecto y esquema de base de datos
  - [x] 1.1 Inicializar monorepo con estructura de directorios
    - Crear estructura: `backend/`, `mobile/`, `dashboard/`, `shared/`
    - Configurar `package.json` raíz con workspaces
    - Configurar TypeScript (`tsconfig.json`) para backend, mobile y dashboard
    - Configurar Jest + fast-check en backend
    - Configurar ESLint y Prettier
    - _Requerimientos: 11.1_

  - [x] 1.2 Crear migraciones de base de datos PostgreSQL
    - Crear tablas: `usuario`, `unidad`, `asignacion_conductor`, `codigo_verificacion`, `inspeccion`, `detalle_inspeccion`, `reporte_falla`, `fotografia`, `ticket`, `historial_ticket`, `evento_bloqueo`, `log_auditoria`, `log_sync_conflicto`
    - Definir restricciones de clave foránea, índices únicos y enums
    - Crear índices recomendados del diseño (idx_inspeccion_unidad_fecha, idx_ticket_unidad_estado, etc.)
    - Insertar datos semilla para los 39 códigos de verificación con su nivel_riesgo
    - _Requerimientos: 11.1, 11.2, 5.1_

  - [ ]* 1.3 Write property test para integridad referencial
    - **Propiedad 18: Integridad referencial**
    - Verificar que inserciones con FK inválidas (unidad_id, conductor_id, inspeccion_id, reporte_falla_id inexistentes) son rechazadas por la base de datos
    - **Valida: Requerimientos 11.2**

  - [x] 1.4 Definir interfaces y tipos compartidos
    - Crear tipos TypeScript para todas las entidades del modelo de datos en `shared/types/`
    - Definir enums: `Rol`, `EstadoUnidad`, `NivelRiesgo`, `EstadoTicket`
    - Definir DTOs: `CrearInspeccionDTO`, `CrearReporteFallaDTO`, `CierreTicketDTO`
    - _Requerimientos: 2.2, 3.4, 5.1, 7.1_

- [x] 2. Módulo de autenticación y RBAC
  - [x] 2.1 Implementar AuthService (login, logout, refreshToken, validateToken)
    - Implementar login con verificación de credenciales y generación de JWT (accessToken 1h, refreshToken 7d)
    - Incluir `unidadAsignada` en la respuesta para rol Conductor (consulta a `asignacion_conductor` por fecha de jornada)
    - Implementar logout con invalidación de token en Redis
    - Implementar refreshToken y validateToken
    - _Requerimientos: 1.1, 1.2, 1.4_

  - [x] 2.2 Implementar middleware RBAC
    - Crear middleware `authorize(rolesPermitidos: Rol[])` que valide el rol del token JWT
    - Retornar HTTP 403 para accesos no autorizados
    - Registrar intentos de acceso no autorizado en `log_auditoria` con userId, recurso y timestamp
    - _Requerimientos: 1.3, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 2.3 Write property test para RBAC comprehensivo
    - **Propiedad 1: RBAC comprehensivo**
    - Generar combinaciones aleatorias de (rol, endpoint) y verificar que el acceso se permite/deniega según la matriz RBAC; verificar HTTP 403 y registro en log de auditoría cuando se deniega
    - **Valida: Requerimientos 1.2, 1.3, 10.2, 10.3, 10.4, 10.5**

  - [ ]* 2.4 Write property test para invalidación de sesión post-logout
    - **Propiedad 17: Invalidación de sesión post-logout**
    - Generar sesiones aleatorias, ejecutar logout, y verificar que el token es rechazado en requests subsiguientes
    - **Valida: Requerimientos 1.4**

  - [x] 2.5 Crear endpoints de autenticación
    - `POST /auth/login` — público
    - `POST /auth/logout` — todos los roles
    - `POST /auth/refresh` — todos los roles
    - Aplicar middleware RBAC a todos los endpoints protegidos
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Checkpoint — Verificar autenticación y RBAC
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Módulo de inspecciones y reportes de falla
  - [x] 4.1 Implementar InspeccionService
    - Implementar `crear()`: validar exactamente 39 códigos con valores en rango [0, 39], registrar con timestamp, conductorId y unidadId
    - Implementar `obtenerPorUnidad()` y `obtenerPorConductor()` con filtros de fecha
    - Rechazar inspecciones incompletas (HTTP 422 con campos pendientes)
    - Asociar cada inspección a la Hoja_Vida de la unidad
    - _Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test para validación de inspección completa
    - **Propiedad 2: Validación de inspección completa**
    - Generar arrays aleatorios de códigos de verificación (variando cantidad y valores) y verificar que solo se aceptan inspecciones con exactamente 39 entradas y valores en [0, 39]
    - **Valida: Requerimientos 2.2, 2.5**

  - [ ]* 4.3 Write property test para registro de inspección con integridad
    - **Propiedad 3: Registro de inspección con integridad**
    - Generar inspecciones válidas aleatorias y verificar que el registro contiene timestamp no nulo, conductorId válido, unidadId válido, y aparece en la Hoja_Vida
    - **Valida: Requerimientos 2.3, 2.4**

  - [x] 4.4 Implementar SemaforoRiesgoService
    - Implementar `clasificar()`: retornar el nivel de riesgo predefinido para cada código de verificación (1-39)
    - Implementar `obtenerClasificacion()`: retornar mapa completo de clasificaciones
    - Cargar clasificación desde tabla `codigo_verificacion`
    - _Requerimientos: 5.1_

  - [ ]* 4.5 Write property test para clasificación automática de semáforo
    - **Propiedad 5: Clasificación automática de semáforo de riesgo**
    - Generar códigos de verificación aleatorios (1-39) y verificar que la clasificación asignada coincide con la tabla de configuración
    - **Valida: Requerimientos 5.1**

  - [x] 4.6 Implementar ReporteFallaService
    - Implementar `crear()`: validar mínimo 1 fotografía, formato JPEG/PNG, tamaño ≤ 10 MB; subir fotos a Object Storage (S3); asignar semáforo automáticamente vía SemaforoRiesgoService
    - Implementar `obtenerPorUnidad()` con filtro por semáforo y `obtenerPorSemaforo()`
    - Vincular reporte a Ticket correspondiente y Hoja_Vida
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 5.1, 5.4_

  - [ ]* 4.7 Write property test para validación de reporte de falla con fotografía
    - **Propiedad 4: Validación de reporte de falla con fotografía**
    - Generar reportes con combinaciones aleatorias de cantidad de fotos, formatos y tamaños; verificar que solo se aceptan reportes con ≥1 foto en JPEG/PNG y ≤10 MB
    - **Valida: Requerimientos 3.1, 3.2, 3.4**

  - [ ]* 4.8 Write property test para filtrado por semáforo de riesgo
    - **Propiedad 6: Filtrado por semáforo de riesgo**
    - Generar arrays aleatorios de reportes de falla con semáforos variados, filtrar por un nivel específico, y verificar que todos los resultados tienen ese nivel y ningún reporte con ese nivel fue omitido
    - **Valida: Requerimientos 5.4**

  - [x] 4.9 Crear endpoints de inspecciones y reportes de falla
    - `POST /inspecciones` — Conductor
    - `GET /inspecciones?unidadId=X` — Administrador
    - `POST /reportes-falla` — Conductor (con upload multipart de fotos)
    - `GET /reportes-falla?semaforo=X` — Administrador
    - Aplicar middleware RBAC correspondiente
    - _Requerimientos: 2.1, 2.3, 3.1, 5.4, 10.2, 10.4_

- [x] 5. Checkpoint — Verificar inspecciones y reportes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Motor de tickets y bloqueo de seguridad
  - [x] 6.1 Implementar TicketService con máquina de estados
    - Implementar `crear()`: crear ticket en estado "Abierto" automáticamente para fallas Críticas o Preventivas; no crear para Informativas
    - Implementar `asignar()`: transición Abierto → En Progreso, notificar al asignado
    - Implementar `cerrar()`: transición En Progreso → Cerrado, validar que `trabajoRealizado` no esté vacío
    - Rechazar transiciones inválidas (HTTP 409)
    - Registrar cada transición en `historial_ticket` con timestamp, userId y descripción
    - _Requerimientos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.2 Write property test para creación automática de tickets
    - **Propiedad 9: Creación automática de tickets**
    - Generar reportes de falla con semáforos aleatorios y verificar que se crea ticket solo para Crítico/Preventivo, nunca para Informativo
    - **Valida: Requerimientos 7.1**

  - [ ]* 6.3 Write property test para máquina de estados del ticket
    - **Propiedad 10: Máquina de estados del ticket**
    - Generar combinaciones aleatorias de (estadoActual, transición) y verificar que solo Abierto→EnProgreso y EnProgreso→Cerrado son aceptadas; todas las demás son rechazadas
    - **Valida: Requerimientos 7.2, 7.3**

  - [ ]* 6.4 Write property test para auditoría de transiciones de ticket
    - **Propiedad 11: Auditoría de transiciones de ticket**
    - Generar transiciones válidas aleatorias y verificar que se crea registro en historial_ticket con estado anterior, estado nuevo, timestamp no nulo, userId no nulo, y descripción no vacía al cierre
    - **Valida: Requerimientos 7.4**

  - [ ]* 6.5 Write property test para validación de cierre de ticket
    - **Propiedad 12: Validación de cierre de ticket**
    - Generar intentos de cierre con `trabajoRealizado` aleatorio (incluyendo vacío y nulo) y verificar que solo se aceptan cierres con trabajo no vacío
    - **Valida: Requerimientos 7.5**

  - [x] 6.6 Implementar lógica de bloqueo de seguridad por fallas críticas
    - Impedir cambio de estado de unidad a "Disponible" si tiene tickets Críticos en estado Abierto o En Progreso (HTTP 409)
    - Habilitar automáticamente el cambio a "Disponible" al cerrar el último ticket Crítico
    - Registrar eventos de bloqueo/desbloqueo en `evento_bloqueo` con timestamp y userId
    - Mostrar alerta al Conductor si intenta marcha con unidad bloqueada (HTTP 403)
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.7 Write property test para invariante de bloqueo de seguridad
    - **Propiedad 7: Invariante de bloqueo de seguridad**
    - Generar arrays aleatorios de tickets con estados y semáforos variados; verificar que el cambio a "Disponible" se permite si y solo si no hay tickets Críticos en Abierto/EnProgreso
    - **Valida: Requerimientos 6.1, 6.3**

  - [ ]* 6.8 Write property test para auditoría de bloqueo y desbloqueo
    - **Propiedad 8: Auditoría de bloqueo y desbloqueo**
    - Generar eventos de bloqueo/desbloqueo aleatorios y verificar que se registra en Hoja_Vida con timestamp no nulo, userId no nulo y tipo correcto
    - **Valida: Requerimientos 6.4**

  - [x] 6.9 Crear endpoints de tickets y bloqueo
    - `POST /tickets/:id/asignar` — Administrador
    - `POST /tickets/:id/cerrar` — Equipo_Mantenimiento
    - `GET /tickets?unidadId=X` — Administrador
    - `GET /tickets?asignadoA=X` — Equipo_Mantenimiento
    - `PATCH /unidades/:id/estado` — Administrador (con validación de bloqueo)
    - _Requerimientos: 7.2, 7.3, 6.1, 10.3, 10.4_

- [x] 7. Checkpoint — Verificar tickets y bloqueo de seguridad
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Hoja de Vida, BI y exportación
  - [x] 8.1 Implementar HojaVidaService
    - Implementar `obtener()`: consolidar datos maestros de unidad + historial de inspecciones, reportes de falla, tickets y eventos de bloqueo/desbloqueo
    - Soportar filtros por rango de fechas, tipo de falla y estado de ticket
    - Ordenar historial cronológicamente (más reciente primero)
    - Implementar `registrarEvento()` para actualizar Hoja_Vida en cada inspección, reporte o cambio de ticket
    - _Requerimientos: 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write property test para completitud de Hoja de Vida
    - **Propiedad 13: Completitud de Hoja de Vida**
    - Generar unidades con conjuntos aleatorios de inspecciones, reportes y tickets; verificar que la Hoja_Vida contiene todos los registros asociados sin huérfanos ni faltantes
    - **Valida: Requerimientos 8.1**

  - [ ]* 8.3 Write property test para ordenamiento cronológico de Hoja de Vida
    - **Propiedad 14: Ordenamiento cronológico de Hoja de Vida**
    - Generar arrays aleatorios de registros con timestamps variados y verificar que el resultado está ordenado de más reciente a más antiguo
    - **Valida: Requerimientos 8.2**

  - [x] 8.4 Implementar BIService
    - Implementar `calcularIndicadores()`: porcentaje de unidades operativas, tiempo promedio de reparación, frecuencia de fallas por unidad en período seleccionable
    - Implementar `exportarCSV()`: generar archivo CSV con los indicadores para un rango de fechas
    - _Requerimientos: 9.4, 9.5_

  - [ ]* 8.5 Write property test para cálculos de indicadores BI
    - **Propiedad 15: Cálculos de indicadores BI**
    - Generar conjuntos aleatorios de unidades y tickets; verificar que el porcentaje operativo = (operativas / total) × 100 y el tiempo promedio = suma(cierre - apertura) / cantidad
    - **Valida: Requerimientos 9.4**

  - [ ]* 8.6 Write property test para round-trip de exportación CSV
    - **Propiedad 16: Round-trip de exportación CSV**
    - Generar indicadores BI aleatorios, exportar a CSV, parsear el CSV y verificar que los valores numéricos y etiquetas coinciden con los originales
    - **Valida: Requerimientos 9.5**

  - [x] 8.7 Crear endpoints de Hoja de Vida y BI
    - `GET /unidades/:id/hoja-vida` — Administrador
    - `GET /dashboard/bi?desde=X&hasta=Y` — Administrador
    - `GET /dashboard/bi/exportar?desde=X&hasta=Y` — Administrador (descarga CSV)
    - _Requerimientos: 8.2, 9.4, 9.5, 10.4_

- [x] 9. Checkpoint — Verificar Hoja de Vida y BI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Sincronización offline y notificaciones
  - [x] 10.1 Implementar SyncService en backend
    - Implementar endpoint `POST /inspecciones/sync` para recibir lote de inspecciones offline
    - Procesar cada inspección con su timestamp local original
    - Detectar conflictos (misma unidad, mismo período) y registrar en `log_sync_conflicto`
    - Notificar al Administrador sobre conflictos para resolución manual
    - Implementar reintento con backoff exponencial (3 intentos: 1s, 5s, 30s)
    - _Requerimientos: 4.2, 4.3_

  - [ ]* 10.2 Write property test para atomicidad transaccional
    - **Propiedad 19: Atomicidad transaccional**
    - Simular operaciones de escritura compuestas (inspección + detalles + reportes + tickets) con fallos en pasos intermedios; verificar que ningún registro parcial persiste
    - **Valida: Requerimientos 11.3**

  - [x] 10.3 Implementar NotificacionService
    - Implementar WebSocket para Dashboard (alertas push en tiempo real)
    - Implementar Push Notifications para App_Movil
    - Enviar alerta crítica al Administrador en ≤30s desde la generación del reporte
    - Enviar notificaciones de cambio de estado de ticket al Equipo_Mantenimiento asignado
    - _Requerimientos: 5.3, 7.1, 7.2, 9.3_

  - [x] 10.4 Crear endpoint de estado de flota en tiempo real
    - `GET /dashboard/estado-flota` — Administrador: estado actual de todas las unidades
    - Integrar con WebSocket para actualizaciones push
    - _Requerimientos: 9.1, 9.3_

- [x] 11. Checkpoint — Verificar sincronización y notificaciones
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. App Móvil (React Native)
  - [x] 12.1 Configurar proyecto React Native con SQLite
    - Inicializar proyecto React Native en `mobile/`
    - Configurar SQLite para almacenamiento offline local
    - Crear esquema SQLite local para inspecciones y reportes pendientes de sincronización
    - Configurar navegación y estructura de pantallas
    - _Requerimientos: 4.1_

  - [x] 12.2 Implementar pantalla de login y vinculación con unidad
    - Pantalla de login con validación de credenciales
    - Almacenar JWT en almacenamiento seguro del dispositivo
    - Mostrar unidad asignada automáticamente tras login exitoso
    - Implementar logout con limpieza de datos de autenticación del dispositivo
    - Mostrar mensaje de error descriptivo para credenciales inválidas
    - _Requerimientos: 1.1, 1.2, 1.4_

  - [x] 12.3 Implementar pantalla de inspección con 39 códigos
    - Interfaz optimizada para selección táctil de los 39 códigos de verificación
    - Permitir asignar valor 0 (Óptimo) o 1-39 (Falla) a cada código
    - Indicar campos pendientes e impedir envío si hay códigos sin estado asignado
    - Mostrar semáforo de riesgo visual (Rojo/Amarillo/Verde) para cada falla reportada
    - _Requerimientos: 2.1, 2.2, 2.5, 5.2_

  - [x] 12.4 Implementar captura de fotos y reporte de falla
    - Integrar cámara y galería para captura/selección de fotos
    - Validar formato JPEG/PNG y tamaño ≤ 10 MB
    - Bloquear envío de reporte sin al menos una fotografía
    - Mostrar mensaje de obligatoriedad de evidencia fotográfica
    - _Requerimientos: 3.1, 3.2, 3.4_

  - [x] 12.5 Implementar modo offline-first con sincronización
    - Almacenar inspecciones y reportes en SQLite cuando no hay conexión
    - Indicador visual de modo offline activo
    - Sincronización automática al recuperar conexión (sin acción manual del Conductor)
    - Cola de operaciones pendientes con estado de sincronización
    - _Requerimientos: 4.1, 4.2, 4.4_

  - [x] 12.6 Implementar alerta de bloqueo de unidad
    - Mostrar alerta cuando el Conductor intenta marcha con unidad bloqueada por falla crítica
    - Indicar razón del bloqueo y tickets asociados
    - _Requerimientos: 6.2_

- [x] 13. Dashboard Web (React + Vite + Tailwind + Framer Motion) — Design System "Elemental Purity"
  - [x] 13.1 Configurar proyecto Dashboard con Design System Biosur
    - Inicializar proyecto React + Vite + Tailwind CSS + Framer Motion en `dashboard/`
    - Configurar Tailwind con la paleta Biosur: primary (#eb681a), secondary (#659833), surface (#ede7e0), surface-container-low (#f5f1ed), surface-container-high (#e5dfd8), surface-container-highest (#ddd7d0), on-surface (#1d1b17), on-surface-variant (#4d4639), outline (#85736e), error (#ba1a1a), brand-dark (#2b1700), brand-light (#fff8f1)
    - Configurar tipografías: Manrope (headlines, labels) + Inter (body)
    - Configurar border-radius: lg (0.5rem), xl (0.75rem), full (1rem)
    - Aplicar regla "No-Line": usar cambios de color de superficie en lugar de bordes para separar secciones
    - Configurar rutas, layout principal y sistema de autenticación (JWT)
    - Configurar conexión WebSocket para notificaciones en tiempo real
    - Referencia de diseño: `stitch_biosur/DESIGN.md` y `stitch_biosur/code.html`
    - _Requerimientos: 9.1_

  - [x] 13.2 Implementar componentes base del Design System
    - TopAppBar fijo con logo "Biosur Eco", navegación y avatar de usuario (bg brand-light, texto primary)
    - BottomNavBar con backdrop-blur y navegación por secciones (Inspections, Reports, Vehicles, Settings)
    - Botones: Primary (gradient primary, rounded-lg, text on-primary), Secondary (surface + ghost border), Tertiary (tipográfico con underline hover)
    - Cards: bg surface-container-low, rounded-xl, hover shadow-lg, sin bordes sólidos (solo border-outline/5)
    - Inputs: bg surface-container-highest, border-bottom ghost, focus border-primary
    - Chips "Eco-Metric": pill-shaped, bg secondary-container, text on-secondary-container
    - Status badges: error/10 para "Due Now", secondary/10 para "Compliant", ffddb9 para "Pending"
    - Ambient shadows: on-surface 10% opacity, blur 30-50px para elementos flotantes
    - Animaciones Framer Motion: transiciones de cards, alertas, cambios de estado
    - _Requerimientos: 9.1_

  - [x] 13.3 Implementar vista centralizada de estado de flota (Fleet Overview)
    - Bento grid layout (1/2/3 columnas responsive) con cards de unidades
    - Cada card: imagen de vehículo, ID de unidad (label uppercase tracking-widest), nombre, última inspección, kilometraje, badge de estado
    - Card destacada "Eco-Fleet Score" (bg brand-dark, texto blanco, indicador circular de salud de flota)
    - Panel lateral "Recent Inspections" con lista de actividad reciente (iconos warning/check_circle)
    - Semáforo visual diferenciado: error para Crítico, primary/amber para Preventivo, secondary para Informativo
    - Alertas push en tiempo real para fallas críticas (≤30s) vía WebSocket con animación Framer Motion
    - Floating Action Button (primary, rounded-full, shadow-2xl)
    - Barra de búsqueda con icono search, bg surface-container-high, focus border-primary
    - _Requerimientos: 9.1, 9.3, 5.2_

  - [x] 13.4 Implementar calendario de inspecciones
    - Calendario perpetuo con inspecciones realizadas y pendientes por unidad y fecha
    - Filtrado por unidad y rango de fechas
    - Estilo editorial: tipografía Manrope para encabezados, Inter para datos, superficies escalonadas
    - _Requerimientos: 9.2_

  - [x] 13.5 Implementar gestión de tickets
    - Lista de tickets con filtros por estado, semáforo y unidad
    - Funcionalidad de asignación de ticket a Equipo_Mantenimiento
    - Vista de detalle de ticket con historial de transiciones
    - Filtrado de reportes de falla por nivel de semáforo
    - Cards sin dividers (usar white space o color shifts), hover transitions surface-container-low → surface-container-high
    - _Requerimientos: 7.2, 5.4_

  - [x] 13.6 Implementar vista de Hoja de Vida por unidad
    - Historial completo ordenado cronológicamente
    - Filtrado por rango de fechas, tipo de falla y estado de ticket
    - Datos maestros de la unidad (Marca, Modelo, Patente, Año)
    - Layout editorial: headline asimétrico a la izquierda, datos a la derecha
    - _Requerimientos: 8.1, 8.2_

  - [x] 13.7 Implementar módulo de BI y exportación CSV
    - Indicadores: porcentaje de unidades operativas, tiempo promedio de reparación, frecuencia de fallas por unidad
    - Selector de período para los indicadores
    - Botón de exportación CSV para rango de fechas seleccionado
    - Gráficos con estilo editorial: colores de la paleta Biosur, tipografía Manrope para labels
    - _Requerimientos: 9.4, 9.5_

- [x] 14. Checkpoint final — Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental entre fases
- Los tests de propiedades validan las 19 propiedades de correctitud del diseño
- Los tests unitarios validan ejemplos específicos y edge cases
- Stack: TypeScript, Node.js + Express, React Native + SQLite, React + Vite + Tailwind CSS + Framer Motion, PostgreSQL, Redis, S3, Jest + fast-check
