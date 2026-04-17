/**
 * StorageService — Abstracción para subir archivos a Object Storage (S3-compatible).
 * Permite inyectar implementaciones reales o mocks en tests.
 */
export interface StorageService {
  /**
   * Sube un archivo al bucket y retorna la URL pública/presignada.
   */
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
}

/**
 * Implementación S3 del StorageService.
 * En producción se conecta a un bucket S3-compatible.
 */
export class S3StorageService implements StorageService {
  constructor(
    private bucket: string,
    private region: string,
  ) {}

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    // TODO: integrar con AWS SDK / S3-compatible client
    // Por ahora retorna la URL esperada del objeto
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
