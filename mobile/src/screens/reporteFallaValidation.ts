/**
 * Pure validation functions for ReporteFallaScreen.
 * Extracted for testability.
 *
 * Requerimientos: 3.1, 3.2, 3.4
 */

export const MAX_FILE_SIZE = 10_485_760; // 10 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export interface PhotoInput {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Validates that a photo meets format (JPEG/PNG) and size (≤10 MB) constraints.
 * Returns an error message string or null if valid.
 */
export function validatePhotoAsset(photo: PhotoInput): string | null {
  const { fileName, mimeType, fileSize } = photo;

  // Validate format via MIME type or file extension
  const isValidMime = ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    fileName.toLowerCase().endsWith(ext),
  );

  if (!isValidMime && !hasValidExtension) {
    return `Formato no soportado: "${fileName}". Use JPEG o PNG.`;
  }

  // Validate size ≤ 10 MB
  if (fileSize > MAX_FILE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    return `La imagen "${fileName}" excede el tamaño máximo (${sizeMB} MB). Máximo permitido: 10 MB.`;
  }

  return null;
}

/**
 * Infers MIME type from file extension when the picker doesn't provide it.
 */
export function inferMimeType(uri: string, mimeType?: string | null): string {
  if (mimeType && ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return mimeType.toLowerCase();
  }
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}
