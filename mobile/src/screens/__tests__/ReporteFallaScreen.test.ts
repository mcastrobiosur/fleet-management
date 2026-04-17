/**
 * Unit tests for ReporteFallaScreen photo validation logic.
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */

import { validatePhotoAsset, inferMimeType } from '../reporteFallaValidation';

describe('ReporteFallaScreen — Photo Validation', () => {
  describe('validatePhotoAsset', () => {
    it('accepts a valid JPEG photo under 10 MB', () => {
      const result = validatePhotoAsset({
        uri: 'file:///photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 5_000_000,
      });
      expect(result).toBeNull();
    });

    it('accepts a valid PNG photo under 10 MB', () => {
      const result = validatePhotoAsset({
        uri: 'file:///photo.png',
        fileName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 1_000_000,
      });
      expect(result).toBeNull();
    });

    it('accepts a photo at exactly 10 MB', () => {
      const result = validatePhotoAsset({
        uri: 'file:///photo.jpeg',
        fileName: 'photo.jpeg',
        mimeType: 'image/jpeg',
        fileSize: 10_485_760,
      });
      expect(result).toBeNull();
    });

    it('rejects a photo exceeding 10 MB', () => {
      const result = validatePhotoAsset({
        uri: 'file:///big.jpg',
        fileName: 'big.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10_485_761,
      });
      expect(result).not.toBeNull();
      expect(result).toContain('excede');
    });

    it('rejects a non-JPEG/PNG format (e.g. GIF)', () => {
      const result = validatePhotoAsset({
        uri: 'file:///anim.gif',
        fileName: 'anim.gif',
        mimeType: 'image/gif',
        fileSize: 500_000,
      });
      expect(result).not.toBeNull();
      expect(result).toContain('Formato no soportado');
    });

    it('rejects a BMP file', () => {
      const result = validatePhotoAsset({
        uri: 'file:///image.bmp',
        fileName: 'image.bmp',
        mimeType: 'image/bmp',
        fileSize: 2_000_000,
      });
      expect(result).not.toBeNull();
      expect(result).toContain('Formato no soportado');
    });

    it('accepts JPEG when mimeType is missing but extension is .jpg', () => {
      const result = validatePhotoAsset({
        uri: 'file:///photo.jpg',
        fileName: 'photo.jpg',
        mimeType: '',
        fileSize: 3_000_000,
      });
      expect(result).toBeNull();
    });

    it('accepts PNG when mimeType is missing but extension is .png', () => {
      const result = validatePhotoAsset({
        uri: 'file:///photo.png',
        fileName: 'photo.png',
        mimeType: '',
        fileSize: 3_000_000,
      });
      expect(result).toBeNull();
    });
  });

  describe('inferMimeType', () => {
    it('returns provided mimeType when valid JPEG', () => {
      expect(inferMimeType('file:///photo.jpg', 'image/jpeg')).toBe('image/jpeg');
    });

    it('returns provided mimeType when valid PNG', () => {
      expect(inferMimeType('file:///photo.png', 'image/png')).toBe('image/png');
    });

    it('infers image/png from .png extension when mimeType is null', () => {
      expect(inferMimeType('file:///photo.png', null)).toBe('image/png');
    });

    it('defaults to image/jpeg for .jpg extension when mimeType is null', () => {
      expect(inferMimeType('file:///photo.jpg', null)).toBe('image/jpeg');
    });

    it('defaults to image/jpeg for unknown extension when mimeType is null', () => {
      expect(inferMimeType('file:///photo.unknown', null)).toBe('image/jpeg');
    });
  });
});
