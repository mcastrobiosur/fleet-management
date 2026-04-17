/**
 * Alerta de bloqueo de unidad por falla crítica.
 *
 * Muestra una tarjeta roja prominente cuando la unidad asignada al
 * Conductor está bloqueada por tener tickets críticos activos.
 * Indica la razón del bloqueo y lista los tickets asociados.
 *
 * Requerimientos: 6.2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Ticket } from '@biosur/shared';

export interface BlockedUnitAlertProps {
  /** Razón del bloqueo (e.g. "Falla crítica activa") */
  razon: string;
  /** Tickets críticos que causan el bloqueo */
  tickets: Pick<Ticket, 'id' | 'semaforoRiesgo' | 'estado'>[];
}

const COLORS = {
  error: '#ba1a1a',
  errorBg: '#ffdad6',
  errorDark: '#690005',
  onErrorContainer: '#410002',
  white: '#ffffff',
} as const;

export default function BlockedUnitAlert({ razon, tickets }: BlockedUnitAlertProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`Unidad bloqueada. ${razon}. ${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} crítico${tickets.length !== 1 ? 's' : ''} activo${tickets.length !== 1 ? 's' : ''}.`}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.title}>Unidad Bloqueada</Text>
      </View>

      <Text style={styles.razon}>{razon}</Text>

      {tickets.length > 0 && (
        <View style={styles.ticketList}>
          <Text style={styles.ticketListLabel}>
            Tickets críticos ({tickets.length}):
          </Text>
          {tickets.map((ticket) => (
            <View key={ticket.id} style={styles.ticketRow}>
              <Text style={styles.ticketBullet}>•</Text>
              <Text style={styles.ticketText}>
                Ticket #{ticket.id.slice(0, 8)} — {ticket.estado}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>
        No es posible iniciar marcha hasta que se resuelvan las fallas críticas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.errorBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
  },
  razon: {
    fontSize: 14,
    color: COLORS.onErrorContainer,
    marginBottom: 12,
  },
  ticketList: {
    marginBottom: 12,
  },
  ticketListLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.errorDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  ticketBullet: {
    fontSize: 14,
    color: COLORS.error,
    marginRight: 6,
    lineHeight: 20,
  },
  ticketText: {
    fontSize: 13,
    color: COLORS.onErrorContainer,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    fontSize: 12,
    color: COLORS.errorDark,
    fontStyle: 'italic',
  },
});
