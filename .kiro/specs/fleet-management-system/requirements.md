# Documento de Requerimientos

## Introducción

Biosur requiere transformar su proceso manual de inspección de flota en un sistema digital, trazable y proactivo. El sistema comprende una aplicación móvil (App_Movil) para conductores y un panel web (Dashboard) para administradores y equipo de mantenimiento. Su objetivo es garantizar la seguridad operativa, reducir tiempos de respuesta ante fallas y mantener un historial técnico completo por unidad vehicular.

El sistema cubre tres flujos principales:
1. Registro de inspecciones diarias por parte del Conductor mediante la App_Movil, con soporte offline.
2. Gestión de criticidad y tickets de reparación entre el Administrador y el Equipo_Mantenimiento.
3. Monitoreo y análisis a través del Dashboard con indicadores de flota.

## Glosario

- **Sistema**: El Sistema de Digitalización y Gestión de Flota de Biosur en su conjunto.
- **App_Movil**: Aplicación móvil utilizada por el Conductor para registrar inspecciones y reportar fallas.
- **Dashboard**: Panel de control web utilizado por el Administrador para monitorear la flota.
- **Conductor**: Usuario que opera un vehículo y realiza inspecciones diarias mediante la App_Movil.
- **Administrador**: Usuario con rol de Administrador de Operaciones que supervisa la flota y gestiona tickets.
- **Equipo_Mantenimiento**: Usuarios responsables de ejecutar reparaciones y cerrar tickets técnicos.
- **Unidad**: Vehículo individual de la flota, identificado por Marca, Modelo, Patente y Año.
- **Inspeccion**: Registro digital de la revisión diaria de una Unidad, compuesto por la evaluación de los 39 Codigos_Verificacion.
- **Codigo_Verificacion**: Uno de los 39 ítems de inspección estandarizados. El valor 0 indica estado Óptimo; los valores 1 a 39 indican fallas específicas.
- **Reporte_Falla**: Registro generado cuando un Codigo_Verificacion indica una falla (valor 1–39), que incluye descripción y evidencia fotográfica.
- **Semaforo_Riesgo**: Clasificación de criticidad de una falla: Crítico (Rojo), Preventivo (Amarillo) o Informativo (Verde).
- **Ticket**: Orden de trabajo generada a partir de un Reporte_Falla, que sigue un ciclo de vida desde su apertura hasta su cierre.
- **Hoja_Vida**: Registro consolidado de una Unidad que incluye sus datos maestros y el historial completo de Inspecciones, Reportes_Falla y Tickets.
- **RBAC**: Control de acceso basado en roles (Role-Based Access Control).
- **API_REST**: Interfaz de programación de aplicaciones de tipo REST que conecta la App_Movil y el Dashboard con el backend.

## Requerimientos

### Requerimiento 1: Autenticación y Vinculación de Conductor con Unidad

**User Story:** Como Conductor, quiero autenticarme con mi cuenta de usuario para que el Sistema me asocie automáticamente con la Unidad que tengo asignada, sin necesidad de seleccionarla manualmente.

#### Criterios de Aceptación

1. WHEN un Conductor inicia sesión en la App_Movil con credenciales válidas, THE Sistema SHALL asociar automáticamente al Conductor con la Unidad asignada a su cuenta para esa jornada.
2. IF un Conductor intenta iniciar sesión con credenciales inválidas, THEN THE App_Movil SHALL mostrar un mensaje de error descriptivo e impedir el acceso al Sistema.
3. THE Sistema SHALL aplicar RBAC para garantizar que cada usuario acceda únicamente a las funciones correspondientes a su rol (Conductor, Administrador, Equipo_Mantenimiento).
4. WHEN un Conductor cierra sesión, THE App_Movil SHALL invalidar la sesión activa y eliminar los datos de autenticación almacenados en el dispositivo.

### Requerimiento 2: Registro de Inspección Diaria con 39 Códigos de Verificación

**User Story:** Como Conductor, quiero registrar la inspección diaria de mi Unidad seleccionando el estado de cada uno de los 39 Codigos_Verificacion, para dejar constancia digital del estado del vehículo.

#### Criterios de Aceptación

1. WHEN un Conductor autenticado inicia una Inspeccion, THE App_Movil SHALL presentar los 39 Codigos_Verificacion con una interfaz optimizada para selección táctil.
2. THE App_Movil SHALL permitir al Conductor asignar el valor 0 (Óptimo) o un valor entre 1 y 39 (Falla) a cada Codigo_Verificacion.
3. WHEN el Conductor completa y envía una Inspeccion, THE Sistema SHALL registrar la Inspeccion con marca de tiempo, identificador del Conductor e identificador de la Unidad.
4. THE Sistema SHALL asociar cada Inspeccion completada a la Hoja_Vida de la Unidad correspondiente.
5. IF el Conductor intenta enviar una Inspeccion con uno o más Codigos_Verificacion sin estado asignado, THEN THE App_Movil SHALL indicar los campos pendientes e impedir el envío hasta que todos los Codigos_Verificacion estén completos.

### Requerimiento 3: Reporte de Falla con Evidencia Fotográfica

**User Story:** Como Conductor, quiero adjuntar al menos una fotografía a cada falla que reporte, para que el Administrador y el Equipo_Mantenimiento cuenten con evidencia visual del problema.

#### Criterios de Aceptación

1. WHEN un Conductor asigna un valor entre 1 y 39 a un Codigo_Verificacion, THE App_Movil SHALL requerir la captura o selección de al menos una fotografía como evidencia del Reporte_Falla.
2. IF el Conductor intenta confirmar un Reporte_Falla sin adjuntar al menos una fotografía, THEN THE App_Movil SHALL bloquear el envío y mostrar un mensaje indicando la obligatoriedad de la evidencia fotográfica.
3. THE Sistema SHALL almacenar las fotografías asociadas al Reporte_Falla y vincularlas al Ticket correspondiente y a la Hoja_Vida de la Unidad.
4. THE App_Movil SHALL aceptar fotografías en formatos JPEG y PNG con un tamaño máximo de 10 MB por imagen.

### Requerimiento 4: Modo Offline-First

**User Story:** Como Conductor, quiero poder registrar inspecciones sin conexión a internet, para que las operaciones en zonas sin cobertura no interrumpan el proceso de registro.

#### Criterios de Aceptación

1. WHILE el dispositivo del Conductor no tiene conexión a internet, THE App_Movil SHALL permitir completar y almacenar Inspecciones localmente en el dispositivo.
2. WHEN el dispositivo del Conductor recupera la conexión a internet, THE App_Movil SHALL sincronizar automáticamente todas las Inspecciones almacenadas localmente con el servidor, sin requerir acción manual del Conductor.
3. IF ocurre un conflicto de datos durante la sincronización, THEN THE Sistema SHALL registrar el conflicto en un log de auditoría y notificar al Administrador para su resolución manual.
4. WHILE el dispositivo opera en modo offline, THE App_Movil SHALL indicar visualmente al Conductor que está trabajando sin conexión y que los datos se sincronizarán al recuperar la conectividad.

### Requerimiento 5: Clasificación de Criticidad (Semáforo de Riesgo)

**User Story:** Como Administrador, quiero que cada falla reportada sea clasificada automáticamente según su nivel de criticidad, para priorizar las acciones de mantenimiento de forma eficiente.

#### Criterios de Aceptación

1. WHEN se genera un Reporte_Falla, THE Sistema SHALL asignar automáticamente un nivel de Semaforo_Riesgo (Crítico, Preventivo o Informativo) según la clasificación predefinida del Codigo_Verificacion.
2. THE Sistema SHALL mostrar el Semaforo_Riesgo de cada Reporte_Falla de forma visual y diferenciada por color (Rojo para Crítico, Amarillo para Preventivo, Verde para Informativo) en la App_Movil y en el Dashboard.
3. WHEN se genera un Reporte_Falla con Semaforo_Riesgo Crítico, THE Sistema SHALL enviar una notificación inmediata al Administrador con un tiempo de entrega máximo de 30 segundos desde la generación del reporte.
4. THE Dashboard SHALL permitir al Administrador consultar y filtrar los Reportes_Falla por nivel de Semaforo_Riesgo.

### Requerimiento 6: Bloqueo de Seguridad por Fallas Críticas

**User Story:** Como Administrador, quiero que el Sistema impida marcar una Unidad como "Disponible" mientras tenga fallas críticas activas, para garantizar que ningún vehículo inseguro sea puesto en operación.

#### Criterios de Aceptación

1. WHILE una Unidad tiene al menos un Ticket con Semaforo_Riesgo Crítico en estado "Abierto" o "En Progreso", THE Sistema SHALL impedir que cualquier usuario cambie el estado de la Unidad a "Disponible".
2. WHEN un Conductor intenta iniciar marcha con una Unidad bloqueada por falla crítica, THE App_Movil SHALL mostrar una alerta indicando que la Unidad está bloqueada y la razón del bloqueo.
3. WHEN el Equipo_Mantenimiento cierra el último Ticket con Semaforo_Riesgo Crítico de una Unidad, THE Sistema SHALL habilitar automáticamente la posibilidad de cambiar el estado de la Unidad a "Disponible".
4. THE Sistema SHALL registrar en la Hoja_Vida de la Unidad cada evento de bloqueo y desbloqueo, incluyendo la marca de tiempo y el identificador del usuario responsable del cambio de estado.

### Requerimiento 7: Ciclo de Vida del Ticket de Reparación

**User Story:** Como Administrador, quiero gestionar el ciclo completo de un Ticket de reparación desde la detección de la falla hasta el cierre técnico, para asegurar la trazabilidad de cada intervención de mantenimiento.

#### Criterios de Aceptación

1. WHEN se genera un Reporte_Falla con Semaforo_Riesgo Crítico o Preventivo, THE Sistema SHALL crear automáticamente un Ticket en estado "Abierto" y notificar al Administrador.
2. WHEN el Administrador asigna un Ticket al Equipo_Mantenimiento, THE Sistema SHALL cambiar el estado del Ticket a "En Progreso" y notificar al miembro del Equipo_Mantenimiento asignado.
3. WHEN el Equipo_Mantenimiento registra el trabajo realizado y adjunta la validación de reparación, THE Sistema SHALL cambiar el estado del Ticket a "Cerrado" y actualizar el estado de la Unidad según corresponda.
4. THE Sistema SHALL registrar en cada Ticket la marca de tiempo de cada cambio de estado, el identificador del usuario responsable y una descripción del trabajo realizado al momento del cierre.
5. IF el Administrador intenta cerrar un Ticket sin que el Equipo_Mantenimiento haya registrado el trabajo realizado, THEN THE Sistema SHALL impedir el cierre y mostrar un mensaje indicando los campos obligatorios pendientes.

### Requerimiento 8: Hoja de Vida por Unidad

**User Story:** Como Administrador, quiero consultar la Hoja_Vida completa de cada Unidad, para tener visibilidad del historial técnico y tomar decisiones informadas sobre mantenimiento.

#### Criterios de Aceptación

1. THE Sistema SHALL mantener una Hoja_Vida por cada Unidad registrada, que consolide: Marca, Modelo, Patente, Año, historial de Inspecciones, Reportes_Falla y Tickets.
2. WHEN el Administrador consulta la Hoja_Vida de una Unidad, THE Dashboard SHALL mostrar el historial completo ordenado cronológicamente, con capacidad de filtrado por rango de fechas, tipo de falla y estado de Ticket.
3. THE Sistema SHALL actualizar la Hoja_Vida de una Unidad cada vez que se registre una Inspeccion, un Reporte_Falla o un cambio de estado en un Ticket asociado a la Unidad.
4. THE Sistema SHALL conservar el historial completo de la Hoja_Vida de cada Unidad por un período mínimo de 5 años desde la fecha de cada registro.

### Requerimiento 9: Panel de Control Web (Dashboard)

**User Story:** Como Administrador, quiero un panel web centralizado con visibilidad en tiempo real del estado de la flota, para monitorear operaciones y tomar decisiones oportunas.

#### Criterios de Aceptación

1. THE Dashboard SHALL mostrar el estado actual de todas las Unidades de la flota (Disponible, Bloqueada, En Mantenimiento, Operativa) en una vista centralizada.
2. THE Dashboard SHALL incluir un calendario perpetuo que muestre las Inspecciones realizadas y las pendientes por Unidad y por fecha.
3. WHEN se genera un Reporte_Falla con Semaforo_Riesgo Crítico, THE Dashboard SHALL mostrar una alerta push en tiempo real al Administrador, con un tiempo de entrega máximo de 30 segundos desde la generación del reporte.
4. THE Dashboard SHALL presentar un módulo de BI con los siguientes indicadores: porcentaje de Unidades operativas, tiempo promedio de reparación por Ticket cerrado y frecuencia de fallas por Unidad en un período seleccionable.
5. THE Dashboard SHALL permitir al Administrador exportar los datos del módulo de BI en formato CSV para un rango de fechas seleccionado.

### Requerimiento 10: Seguridad y Comunicación

**User Story:** Como Administrador, quiero que toda la comunicación entre la App_Movil, el Dashboard y el backend esté cifrada y controlada por roles, para proteger la integridad y confidencialidad de los datos operativos.

#### Criterios de Aceptación

1. THE API_REST SHALL cifrar toda la comunicación entre la App_Movil, el Dashboard y el servidor mediante TLS 1.2 o superior.
2. THE Sistema SHALL implementar RBAC de forma que un Conductor únicamente pueda acceder a las funciones de registro de Inspecciones y consulta de sus propios Reportes_Falla.
3. THE Sistema SHALL implementar RBAC de forma que el Equipo_Mantenimiento únicamente pueda acceder a los Tickets asignados y al registro de trabajos realizados.
4. THE Sistema SHALL implementar RBAC de forma que el Administrador pueda acceder a todas las funciones del Dashboard, incluyendo gestión de Tickets, consulta de Hojas_Vida y módulo de BI.
5. IF un usuario intenta acceder a una función fuera de su rol asignado, THEN THE API_REST SHALL rechazar la solicitud con un código de error HTTP 403 y registrar el intento de acceso no autorizado en un log de auditoría.

### Requerimiento 11: Persistencia y Escalabilidad de Datos

**User Story:** Como Administrador, quiero que el Sistema almacene todos los datos en una base de datos relacional robusta, para garantizar la integridad del historial técnico a largo plazo.

#### Criterios de Aceptación

1. THE Sistema SHALL almacenar todos los datos de Inspecciones, Reportes_Falla, Tickets y Hojas_Vida en una base de datos PostgreSQL.
2. THE Sistema SHALL garantizar la integridad referencial entre Unidades, Conductores, Inspecciones, Reportes_Falla y Tickets mediante restricciones de clave foránea en la base de datos.
3. WHEN se realiza una operación de escritura en la base de datos, THE Sistema SHALL completar la transacción en su totalidad o revertirla completamente en caso de error, sin dejar registros en estado inconsistente.
4. THE Sistema SHALL soportar el registro concurrente de Inspecciones de múltiples Conductores sin degradación de la integridad de los datos.
