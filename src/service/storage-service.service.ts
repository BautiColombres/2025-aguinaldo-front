import { buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';

export interface UploadResponse {
  url: string;
  fileName: string;
}

export interface TurnFileInfo {
  url: string;
  fileName: string;
  uploadedAt: string;
}

export interface ErrorResponse {
  error: string;
}

const FILE_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] as const,
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png'] as const,
  TIMEOUT: 10000 
};

export class StorageService {

  // FSEC-L2 — this client-side file validation is a UX convenience ONLY. The backend
  // is the source of truth: it independently sanitizes the filename (BSEC-H-2) and
  // re-validates size/type/extension via @Valid (BSEC-M-1). Do NOT weaken these checks
  // and never rely on them as the sole security gate.
  static validateFile(file: File): void {
    if (!file) {
      throw new Error('Archivo requerido');
    }

    if (file.size > FILE_CONFIG.MAX_SIZE) {
      throw new Error('El archivo no puede superar los 5MB');
    }

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!(FILE_CONFIG.ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new Error('Extensión de archivo no válida. Solo se permiten: PDF, JPG, PNG');
    }

    if (!(FILE_CONFIG.ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Solo se permiten archivos PDF, JPG y PNG');
    }
  }

  private static async handleApiError(response: Response): Promise<never> {
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || `Operación falló! Status: ${response.status}`);
    } catch {
      throw new Error(`Operación falló! Status: ${response.status}`);
    }
  }

  private static createFetchWithTimeout(url: string, options: RequestInit, timeout: number = FILE_CONFIG.TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    return fetch(url, {
      ...options,
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  }

  static async uploadTurnFile(
    accessToken: string,
    turnId: string,
    file: File
  ): Promise<UploadResponse> {
    this.validateFile(file);

    const formData = new FormData();
    formData.append('turnId', turnId);
    formData.append('file', file);

    const url = buildApiUrl('/api/storage/upload-turn-file');

    try {
      const response = await this.createFetchWithTimeout(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      return await response.json();
    } catch (error) {
      logger.error('Turn file upload failed:', error);
      throw error;
    }
  }

  static async deleteTurnFile(accessToken: string, turnId: string): Promise<void> {
    const url = buildApiUrl(`/api/storage/delete-turn-file/${turnId}`);

    try {
      const response = await this.createFetchWithTimeout(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'DELETE',
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }
    } catch (error) {
      logger.error('Turn file delete failed:', error);
      throw error;
    }
  }

  static async deleteFile(accessToken: string, bucketName: string, fileName: string): Promise<void> {
    const url = buildApiUrl(`/api/storage/delete/${bucketName}/${fileName}`);

    try {
      const response = await this.createFetchWithTimeout(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'DELETE',
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }
    } catch (error) {
      logger.error('File delete failed:', error);
      throw error;
    }
  }

  static async getPublicUrl(accessToken: string, bucketName: string, fileName: string): Promise<string> {
    const url = buildApiUrl(`/api/storage/url/${bucketName}/${fileName}`);

    try {
      const response = await this.createFetchWithTimeout(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: UploadResponse = await response.json();
      return result.url;
    } catch (error) {
      logger.error('Get public URL failed:', error);
      throw error;
    }
  }

  static getFileConfig() {
    return FILE_CONFIG;
  }
}