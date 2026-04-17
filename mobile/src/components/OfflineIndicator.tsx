/**
 * Indicador visual de modo offline.
 *
 * Muestra un banner en la parte superior de la pantalla cuando el
 * dispositivo no tiene conexión a internet, informando al Conductor
 * que los datos se sincronizarán al recuperar conectividad.
 *
 * Requerimientos: 4.4
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OfflineIndicatorProps {
  /** Número de operaciones pendientes de sincronización */
  pendingCount?: number;
}

const COLORS = {
  warning: '#f59e0b',
  warningDark: '#92400e',
  warningBg: '#fef3c7',
} as const;

export default function OfflineIndicator({ pendingCount = 0 }: OfflineIndicatorProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`Sin conexión a internet. ${
        pendingCount > 0
          ? `${pendingCount} operación${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de sincronización.`
          : 'Los datos se sincronizarán al recuperar la conectividad.'
      }`}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>⚠</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Sin conexión</Text>
          <Text style={styles.subtitle}>
            {pendingCount > 0
              ? `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} de sincronización`
              : 'Los datos se sincronizarán automáticamente'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.warningDark,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.warningDark,
    marginTop: 1,
    opacity: 0.8,
  },
});
