/**
 * Pantalla Home — Vista principal del Conductor.
 * Muestra la unidad asignada tras login exitoso y permite logout.
 * Muestra alerta de bloqueo si la unidad tiene fallas críticas activas.
 *
 * Requerimientos: 1.1, 1.4, 6.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient, ApiError } from '../api/client';
import { clearTokens } from '../storage/auth';
import { useSyncManager } from '../hooks/useSyncManager';
import OfflineIndicator from '../components/OfflineIndicator';
import BlockedUnitAlert from '../components/BlockedUnitAlert';
import type { Ticket } from '@biosur/shared';
import { EstadoUnidad } from '@biosur/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface BlockedUnitInfo {
  razon: string;
  tickets: Pick<Ticket, 'id' | 'semaforoRiesgo' | 'estado'>[];
}

const COLORS = {
  primary: '#eb681a',
  surface: '#ede7e0',
  onSurface: '#1d1b17',
  onSurfaceVariant: '#4d4639',
  secondary: '#659833',
  white: '#ffffff',
  surfaceContainerLow: '#f5f1ed',
  outline: '#85736e',
} as const;

export default function HomeScreen({ navigation, route }: Props) {
  const { unidadAsignada, nombreUsuario } = route.params;
  const [loggingOut, setLoggingOut] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<BlockedUnitInfo | null>(null);
  const { isOnline, syncState } = useSyncManager();

  const checkBlockedUnit = useCallback(async () => {
    if (!unidadAsignada || unidadAsignada.estado !== EstadoUnidad.BLOQUEADA) {
      setBlockedInfo(null);
      return;
    }

    try {
      const { data } = await apiClient.get<{
        error: string;
        razon: string;
        tickets: Pick<Ticket, 'id' | 'semaforoRiesgo' | 'estado'>[];
      }>(`/unidades/${unidadAsignada.id}/verificar-marcha`);

      // If the endpoint returns successfully, the unit is not blocked
      setBlockedInfo(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const body = err.data as {
          error?: string;
          razon?: string;
          tickets?: Pick<Ticket, 'id' | 'semaforoRiesgo' | 'estado'>[];
        };
        setBlockedInfo({
          razon: body.razon ?? 'Falla crítica activa',
          tickets: body.tickets ?? [],
        });
      } else {
        // On network errors, fall back to local estado check
        setBlockedInfo({
          razon: 'Falla crítica activa',
          tickets: [],
        });
      }
    }
  }, [unidadAsignada]);

  useEffect(() => {
    checkBlockedUnit();
  }, [checkBlockedUnit]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Even if the server call fails, clear local tokens
    }
    await clearTokens();
    setLoggingOut(false);

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const confirmLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Está seguro que desea cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: handleLogout },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Offline indicator */}
      {!isOnline && <OfflineIndicator pendingCount={syncState.pendingCount} />}

      {/* Blocked unit alert — Req 6.2 */}
      {blockedInfo && (
        <BlockedUnitAlert razon={blockedInfo.razon} tickets={blockedInfo.tickets} />
      )}

      <View style={styles.greeting}>
        <Text style={styles.welcomeLabel}>Bienvenido</Text>
        <Text style={styles.userName}>{nombreUsuario}</Text>
      </View>

      {unidadAsignada ? (
        <View style={styles.unitCard}>
          <Text style={styles.unitCardTitle}>Unidad Asignada</Text>
          <Text style={styles.unitName}>
            {unidadAsignada.marca} {unidadAsignada.modelo}
          </Text>
          <View style={styles.unitDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Patente</Text>
              <Text style={styles.detailValue}>{unidadAsignada.patente}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Año</Text>
              <Text style={styles.detailValue}>{unidadAsignada.anio}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado</Text>
              <Text style={styles.detailValue}>{unidadAsignada.estado}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noUnitCard}>
          <Text style={styles.noUnitText}>
            No tiene una unidad asignada para esta jornada.
          </Text>
        </View>
      )}

      {unidadAsignada && !blockedInfo && (
        <TouchableOpacity
          style={styles.inspectionButton}
          onPress={() => navigation.navigate('Inspeccion', { unidadId: unidadAsignada.id })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Iniciar inspección diaria"
        >
          <Text style={styles.inspectionButtonText}>Iniciar Inspección Diaria</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={confirmLogout}
        disabled={loggingOut}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        {loggingOut ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  greeting: {
    marginBottom: 28,
  },
  welcomeLabel: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  unitCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  unitCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  unitName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 16,
  },
  unitDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  noUnitCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  noUnitText: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  inspectionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  inspectionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 32,
  },
  logoutText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
