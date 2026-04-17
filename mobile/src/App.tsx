/**
 * Componente raíz de la App Móvil Biosur.
 *
 * Inicializa SQLite al montar, configura el monitoreo de red
 * y la sincronización automática offline-first.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './navigation/AppNavigator';
import { initDatabase } from './db/database';
import { refreshPendingCount } from './services/sync-manager';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => refreshPendingCount())
      .then(() => setReady(true))
      .catch((err) => console.error('Failed to init database:', err));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#eb681a" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
