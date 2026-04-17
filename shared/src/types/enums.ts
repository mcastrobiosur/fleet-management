// Enums del sistema de gestión de flota Biosur

export enum Rol {
  CONDUCTOR = 'conductor',
  ADMINISTRADOR = 'administrador',
  EQUIPO_MANTENIMIENTO = 'equipo_mantenimiento',
}

export enum EstadoUnidad {
  DISPONIBLE = 'disponible',
  BLOQUEADA = 'bloqueada',
  EN_MANTENIMIENTO = 'en_mantenimiento',
  OPERATIVA = 'operativa',
}

export enum NivelRiesgo {
  CRITICO = 'critico',
  PREVENTIVO = 'preventivo',
  INFORMATIVO = 'informativo',
}

export enum EstadoTicket {
  ABIERTO = 'abierto',
  EN_PROGRESO = 'en_progreso',
  CERRADO = 'cerrado',
}

export enum TipoBloqueo {
  BLOQUEO = 'bloqueo',
  DESBLOQUEO = 'desbloqueo',
}

export enum FormatoFoto {
  JPEG = 'jpeg',
  PNG = 'png',
}
