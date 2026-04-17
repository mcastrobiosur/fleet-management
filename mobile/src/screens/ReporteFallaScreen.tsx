/**
 * Pantalla de Reporte de Falla — Captura de evidencia fotográfica.
 * Requiere al menos una foto en JPEG/PNG (≤ 10 MB).
 *
 * Requerimientos: 3.1, 3.2, 3.4
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getToken } from '../storage/auth';
import {
  validatePhotoAsset,
  inferMimeType,
  type PhotoInput,
} from './reporteFallaValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'ReporteFalla'>;

const COLORS = {
  primary: '#eb681a',
  secondary: '#659833',
  surface: '#ede7e0',
  surfaceContainerLow: '#f5f1ed',
  surfaceContainerHigh: '#e5dfd8',
  surfaceContainerHighest: '#ddd7d0',
  onSurface: '#1d1b17',
  onSurfaceVariant: '#4d4639',
  outline: '#85736e',
  white: '#ffffff',
  error: '#ba1a1a',
  brandDark: '#2b1700',
  brandLight: '#fff8f1',
} as const;

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.biosur.com/api';

type PhotoAsset = PhotoInput;

export default function ReporteFallaScreen({ navigation, route }: Props) {
  const { codigoVerificacionId } = route.params;
  const [descripcion, setDescripcion] = useState('');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasPhotos = photos.length > 0;
  const canSubmit = hasPhotos && !submitting;

  const clearError = useCallback(() => setErrorMessage(null), []);

  // -----------------------------------------------------------------------
  // Photo picking helpers
  // -----------------------------------------------------------------------

  const processPickerResult = useCallback(
    (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled || !result.assets?.length) return;

      const newPhotos: PhotoAsset[] = [];

      for (const asset of result.assets) {
        const mimeType = asset.mimeType ?? '';
        const fileName =
          asset.fileName ?? asset.uri.split('/').pop() ?? '';
        const fileSize = asset.fileSize ?? 0;

        const validationError = validatePhotoAsset({
          uri: asset.uri,
          fileName,
          mimeType,
          fileSize,
        });
        if (validationError) {
          setErrorMessage(validationError);
          return;
        }

        newPhotos.push({
          uri: asset.uri,
          fileName:
            asset.fileName ?? `foto_${Date.now()}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`,
          mimeType: inferMimeType(asset.uri, asset.mimeType),
          fileSize: asset.fileSize ?? 0,
        });
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
      clearError();
    },
    [clearError],
  );

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso Requerido',
        'Se necesita acceso a la cámara para capturar evidencia fotográfica.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });

    processPickerResult(result);
  }, [processPickerResult]);

  const handlePickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso Requerido',
        'Se necesita acceso a la galería para seleccionar evidencia fotográfica.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    processPickerResult(result);
  }, [processPickerResult]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!hasPhotos) {
      setErrorMessage(
        'Debe adjuntar al menos una fotografía como evidencia de la falla.',
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const token = await getToken();

      const formData = new FormData();
      formData.append('codigoVerificacionId', String(codigoVerificacionId));
      formData.append('descripcion', descripcion.trim());

      for (const photo of photos) {
        formData.append('fotografias', {
          uri: photo.uri,
          name: photo.fileName,
          type: photo.mimeType,
        } as unknown as Blob);
      }

      const response = await fetch(`${API_BASE_URL}/reportes-falla`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Note: Do NOT set Content-Type for FormData — fetch sets it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg =
          (errorData as { error?: string })?.error ??
          `Error del servidor (${response.status})`;
        throw new Error(msg);
      }

      Alert.alert(
        'Reporte Enviado',
        'El reporte de falla se registró correctamente.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`No se pudo enviar el reporte: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }, [hasPhotos, codigoVerificacionId, descripcion, photos, navigation]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>CÓDIGO DE VERIFICACIÓN</Text>
          <Text style={styles.headerValue}>#{codigoVerificacionId}</Text>
        </View>

        {/* Description field */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción de la falla</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describa la falla observada..."
            placeholderTextColor={COLORS.outline}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Descripción de la falla"
          />
        </View>

        {/* Photo evidence section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidencia fotográfica</Text>
          <Text style={styles.photoRequirement}>
            Se requiere al menos una fotografía (JPEG o PNG, máx. 10 MB)
          </Text>

          {/* Photo action buttons */}
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Tomar foto con cámara"
            >
              <Text style={styles.photoActionIcon}>📷</Text>
              <Text style={styles.photoActionText}>Cámara</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handlePickFromGallery}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar foto de galería"
            >
              <Text style={styles.photoActionIcon}>🖼️</Text>
              <Text style={styles.photoActionText}>Galería</Text>
            </TouchableOpacity>
          </View>

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <View style={styles.thumbnailGrid}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.thumbnailContainer}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.thumbnail}
                    accessibilityLabel={`Foto ${index + 1}: ${photo.fileName}`}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemovePhoto(index)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar foto ${index + 1}`}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.thumbnailSize} numberOfLines={1}>
                    {(photo.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* No photos warning */}
          {!hasPhotos && (
            <View style={styles.noPhotosWarning}>
              <Text style={styles.noPhotosIcon}>⚠️</Text>
              <Text style={styles.noPhotosText}>
                No se han adjuntado fotografías. Es obligatorio incluir al menos
                una foto como evidencia de la falla.
              </Text>
            </View>
          )}
        </View>

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      {/* Submit footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Enviar reporte de falla"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {hasPhotos
                ? `Enviar Reporte (${photos.length} foto${photos.length !== 1 ? 's' : ''})`
                : 'Adjunte al menos una foto'}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // --- Header ---
  header: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.onSurface,
  },

  // --- Sections ---
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 8,
  },

  // --- Description Input ---
  textInput: {
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.onSurface,
    minHeight: 100,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.surfaceContainerHigh,
  },

  // --- Photo Section ---
  photoRequirement: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoActionButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.outline}33`,
    borderStyle: 'dashed',
  },
  photoActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // --- Thumbnails ---
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbnailContainer: {
    width: 100,
    alignItems: 'center',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailSize: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },

  // --- No Photos Warning ---
  noPhotosWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ba1a1a0d',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  noPhotosIcon: {
    fontSize: 18,
  },
  noPhotosText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    lineHeight: 18,
  },

  // --- Error ---
  errorContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#ba1a1a14',
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    lineHeight: 18,
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
});
