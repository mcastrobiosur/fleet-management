/**
 * Pantalla de Login — Autenticación del Conductor.
 * Valida credenciales contra el backend y almacena JWT en SecureStore.
 * Muestra unidad asignada automáticamente tras login exitoso.
 *
 * Requerimientos: 1.1, 1.2, 1.4
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient, ApiError } from '../api/client';
import { setTokens } from '../storage/auth';
import type { AuthResponse } from '@biosur/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const COLORS = {
  primary: '#eb681a',
  surface: '#ede7e0',
  onSurface: '#1d1b17',
  onSurfaceVariant: '#4d4639',
  error: '#ba1a1a',
  white: '#ffffff',
  outline: '#85736e',
  surfaceContainerHigh: '#e5dfd8',
} as const;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Ingrese su correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      await setTokens(data.accessToken, data.refreshToken);

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Home',
            params: {
              unidadAsignada: data.unidadAsignada,
              nombreUsuario: data.user.nombre,
            },
          },
        ],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorMsg('Credenciales inválidas. Verifique su correo y contraseña.');
      } else if (err instanceof ApiError) {
        const msg =
          (err.data as { error?: string })?.error ?? 'Error del servidor.';
        setErrorMsg(msg);
      } else {
        setErrorMsg('No se pudo conectar con el servidor. Intente más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Biosur</Text>
          <Text style={styles.title}>Fleet Management</Text>
          <Text style={styles.subtitle}>Iniciar Sesión</Text>
        </View>

        <View style={styles.form}>
          {errorMsg !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="conductor@biosur.com"
            placeholderTextColor={COLORS.outline}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
            accessibilityLabel="Correo electrónico"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.outline}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!loading}
            accessibilityLabel="Contraseña"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.onSurface,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.onSurface,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.outline,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#ba1a1a18',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
