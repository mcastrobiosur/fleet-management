/**
 * Pantalla de Inspección — Registro de los 39 códigos de verificación.
 * Interfaz optimizada para selección táctil con semáforo de riesgo visual.
 *
 * Requerimientos: 2.1, 2.2, 2.5, 5.2
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../api/client';
import {
  CODIGOS_VERIFICACION,
  CATEGORIAS,
  SEMAFORO_COLORS,
  SEMAFORO_LABELS,
  type CodigoVerificacion,
} from '../data/codigos-verificacion';
import type { CrearInspeccionDTO } from '@biosur/shared';
import { enqueueInspeccion } from '../services/sync-manager';
import { useSyncManager } from '../hooks/useSyncManager';
import OfflineIndicator from '../components/OfflineIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'Inspeccion'>;

const COLORS = {
  primary: '#eb681a',
  secondary: '#659833',
  surface: '#ede7e0',
  surfaceContainerLow: '#f5f1ed',
  surfaceContainerHigh: '#e5dfd8',
  onSurface: '#1d1b17',
  onSurfaceVariant: '#4d4639',
  outline: '#85736e',
  white: '#ffffff',
  error: '#ba1a1a',
  brandDark: '#2b1700',
  optimoGreen: '#4caf50',
} as const;

/** Possible states for each code: null = pending, 0 = óptimo, 1 = falla */
type CodigoEstado = null | 0 | 1;

interface SectionData {
  title: string;
  data: CodigoVerificacion[];
}

export default function InspeccionScreen({ navigation, route }: Props) {
  const { unidadId } = route.params;
  const { isOnline, syncState } = useSyncManager();

  // Map of codigoId → estado (null=pending, 0=óptimo, 1=falla)
  const [estados, setEstados] = useState<Record<number, CodigoEstado>>(() => {
    const initial: Record<number, CodigoEstado> = {};
    CODIGOS_VERIFICACION.forEach((c) => {
      initial[c.id] = null;
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Build sections grouped by category
  const sections: SectionData[] = useMemo(
    () =>
      CATEGORIAS.map((cat) => ({
        title: cat,
        data: CODIGOS_VERIFICACION.filter((c) => c.categoria === cat),
      })),
    [],
  );

  // Counters
  const completados = useMemo(
    () => Object.values(estados).filter((v) => v !== null).length,
    [estados],
  );
  const pendientes = 39 - completados;
  const fallas = useMemo(
    () => Object.values(estados).filter((v) => v === 1).length,
    [estados],
  );
  const allComplete = pendientes === 0;

  const toggleCodigo = useCallback((codigoId: number) => {
    setEstados((prev) => {
      const current = prev[codigoId];
      // Cycle: null → 0 (óptimo) → 1 (falla) → 0 (óptimo)
      let next: CodigoEstado;
      if (current === null) {
        next = 0;
      } else if (current === 0) {
        next = 1;
      } else {
        next = 0;
      }
      return { ...prev, [codigoId]: next };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!allComplete) return;

    setSubmitting(true);
    setSubmitError(null);

    const codigos = CODIGOS_VERIFICACION.map((c) => ({
      codigoId: c.id,
      valor: estados[c.id] === 0 ? 0 : c.id,
    }));

    const payload: CrearInspeccionDTO = {
      conductorId: '',
      unidadId,
      codigos,
      creadoOffline: !isOnline,
      timestampLocal: new Date(),
    };

    try {
      if (isOnline) {
        await apiClient.post('/inspecciones', payload);
      } else {
        const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await enqueueInspeccion(offlineId, payload as unknown as Record<string, unknown>);
      }
      navigation.goBack();
    } catch (error) {
      console.error('[InspeccionScreen] submit error:', error);
      // Fallback: queue offline
      try {
        const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await enqueueInspeccion(
          offlineId,
          { ...payload, creadoOffline: true } as unknown as Record<string, unknown>,
        );
        navigation.goBack();
      } catch (offlineError) {
        console.error('[InspeccionScreen] offline fallback error:', offlineError);
        setSubmitError('No se pudo guardar la inspección. Verifique su conexión e intente nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [allComplete, estados, navigation, isOnline, unidadId]);

  const renderItem = useCallback(
    ({ item }: { item: CodigoVerificacion }) => {
      const estado = estados[item.id];
      const isPending = estado === null;
      const isOptimo = estado === 0;
      const isFalla = estado === 1;

      return (
        <TouchableOpacity
          style={[
            styles.codigoRow,
            isPending && styles.codigoRowPending,
            isOptimo && styles.codigoRowOptimo,
            isFalla && styles.codigoRowFalla,
          ]}
          onPress={() => toggleCodigo(item.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Código ${item.id}: ${item.nombre}. Estado: ${
            isPending ? 'Pendiente' : isOptimo ? 'Óptimo' : 'Falla'
          }`}
          accessibilityHint="Toque para cambiar el estado"
        >
          <View style={styles.codigoLeft}>
            <View
              style={[
                styles.statusIndicator,
                isPending && styles.statusPending,
                isOptimo && styles.statusOptimo,
                isFalla && {
                  backgroundColor: SEMAFORO_COLORS[item.nivelRiesgo],
                },
              ]}
            >
              <Text style={styles.statusText}>
                {isPending ? '?' : isOptimo ? '✓' : '✗'}
              </Text>
            </View>
            <View style={styles.codigoInfo}>
              <Text style={styles.codigoNombre}>
                <Text style={styles.codigoId}>{item.id}. </Text>
                {item.nombre}
              </Text>
              {isFalla && (
                <View
                  style={[
                    styles.semaforoBadge,
                    { backgroundColor: `${SEMAFORO_COLORS[item.nivelRiesgo]}18` },
                  ]}
                >
                  <View
                    style={[
                      styles.semaforoDot,
                      { backgroundColor: SEMAFORO_COLORS[item.nivelRiesgo] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.semaforoLabel,
                      { color: SEMAFORO_COLORS[item.nivelRiesgo] },
                    ]}
                  >
                    {SEMAFORO_LABELS[item.nivelRiesgo]}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text
            style={[
              styles.estadoLabel,
              isPending && styles.estadoLabelPending,
              isOptimo && styles.estadoLabelOptimo,
              isFalla && { color: SEMAFORO_COLORS[item.nivelRiesgo] },
            ]}
          >
            {isPending ? 'Pendiente' : isOptimo ? 'Óptimo' : 'Falla'}
          </Text>
        </TouchableOpacity>
      );
    },
    [estados, toggleCodigo],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Offline indicator */}
      {!isOnline && <OfflineIndicator pendingCount={syncState.pendingCount} />}

      {/* Progress header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>Progreso de Inspección</Text>
          <Text style={styles.progressCount}>
            {completados}/39 completados
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${(completados / 39) * 100}%` },
              allComplete ? styles.progressBarComplete : null,
            ]}
          />
        </View>
        <View style={styles.statsRow}>
          {pendientes > 0 && (
            <View style={[styles.statBadge, styles.statPending]}>
              <Text style={styles.statPendingText}>
                {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {fallas > 0 && (
            <View style={[styles.statBadge, styles.statFallas]}>
              <Text style={styles.statFallasText}>
                {fallas} falla{fallas !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {allComplete && fallas === 0 && (
            <View style={[styles.statBadge, styles.statAllGood]}>
              <Text style={styles.statAllGoodText}>Todo óptimo</Text>
            </View>
          )}
        </View>
      </View>

      {/* Codes list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
      />

      {/* Submit button */}
      <View style={styles.footer}>
        {submitError && (
          <Text style={styles.submitError}>{submitError}</Text>
        )}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !allComplete && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!allComplete || submitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Enviar inspección"
          accessibilityState={{ disabled: !allComplete || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {allComplete
                ? 'Enviar Inspección'
                : `Completar ${pendientes} código${pendientes !== 1 ? 's' : ''}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  // --- Progress Header ---
  progressHeader: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  progressCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: COLORS.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statPending: {
    backgroundColor: '#ffddb9',
  },
  statPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.brandDark,
  },
  statFallas: {
    backgroundColor: '#ba1a1a18',
  },
  statFallasText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  statAllGood: {
    backgroundColor: '#65983318',
  },
  statAllGoodText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  // --- Section Headers ---
  sectionHeader: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // --- Code Rows ---
  listContent: {
    paddingBottom: 16,
  },
  codigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.surfaceContainerHigh,
  },
  codigoRowPending: {
    backgroundColor: COLORS.white,
  },
  codigoRowOptimo: {
    backgroundColor: '#f0f9f0',
  },
  codigoRowFalla: {
    backgroundColor: '#fff8f1',
  },
  codigoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusPending: {
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  statusOptimo: {
    backgroundColor: COLORS.optimoGreen,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  codigoInfo: {
    flex: 1,
  },
  codigoNombre: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.onSurface,
  },
  codigoId: {
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  },
  semaforoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  semaforoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  semaforoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  estadoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  estadoLabelPending: {
    color: COLORS.outline,
  },
  estadoLabelOptimo: {
    color: COLORS.optimoGreen,
  },

  // --- Footer / Submit ---
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.outline,
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  submitError: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
});
