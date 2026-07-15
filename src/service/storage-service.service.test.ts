import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage-service.service';

// Mock the API config
vi.mock('../../config/api', () => ({
  // FBUG-003 — services now issue authenticated requests through the centralized
  // `authenticatedFetch` interceptor (401 -> refresh -> retry, covered in config/api.test.ts).
  // Here it is stubbed to a plain fetch so these suites keep asserting the request shape.
  authenticatedFetch: vi.fn(
    (
      url: string,
      token: string,
      init: Omit<RequestInit, 'headers'> & {
        headers?: Record<string, string>;
        omitJsonContentType?: boolean;
      } = {},
    ) => {
    const { omitJsonContentType, headers, ...rest } = init;
    return fetch(url, {
      ...rest,
      headers: {
        ...(omitJsonContentType ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      signal: AbortSignal.timeout(10000),
    });
  }),
  buildApiUrl: vi.fn((endpoint: string) => `http://localhost:8080${endpoint}`),
  getAuthenticatedFetchOptions: vi.fn((token: string) => ({
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }))
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadTurnFile', () => {
    const mockUploadResponse = {
      url: 'https://example.com/file.pdf',
      fileName: 'test-file.pdf'
    };

    it('should successfully upload a turn file', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUploadResponse)
      });

      const result = await StorageService.uploadTurnFile('test-token', 'turn-1', mockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/storage/upload-turn-file',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token'
          },
          body: expect.any(FormData),
          signal: expect.any(AbortSignal)
        })
      );

      // Verify FormData contains correct values
      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.get('turnId')).toBe('turn-1');
      expect(formData.get('file')).toBe(mockFile);

      expect(result).toEqual(mockUploadResponse);
    });

    it('should throw error when upload fails with error details', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const errorResponse = { error: 'Upload failed due to invalid file' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(StorageService.uploadTurnFile('test-token', 'turn-1', mockFile))
        .rejects.toThrow('Operación falló! Status: 400');
    });

    it('should throw error with default message when response has no error details', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(StorageService.uploadTurnFile('test-token', 'turn-1', mockFile))
        .rejects.toThrow('Operación falló! Status: 500');
    });

    it('should throw error when fetch fails', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(StorageService.uploadTurnFile('test-token', 'turn-1', mockFile))
        .rejects.toThrow('Network error');
    });

    it('should throw error when response.json() fails', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(StorageService.uploadTurnFile('test-token', 'turn-1', mockFile))
        .rejects.toThrow('Operación falló! Status: 400');
    });
  });

  describe('deleteTurnFile', () => {
    it('should successfully delete a turn file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(StorageService.deleteTurnFile('test-token', 'turn-1'))
        .resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/storage/delete-turn-file/turn-1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should throw error when delete fails with error details', async () => {
      const errorResponse = { error: 'File not found' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(StorageService.deleteTurnFile('test-token', 'turn-1'))
        .rejects.toThrow('Operación falló! Status: 404');
    });

    it('should throw error with default message when response has no error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(StorageService.deleteTurnFile('test-token', 'turn-1'))
        .rejects.toThrow('Operación falló! Status: 500');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(StorageService.deleteTurnFile('test-token', 'turn-1'))
        .rejects.toThrow('Network error');
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(StorageService.deleteFile('test-token', 'bucket-1', 'file.pdf'))
        .resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/storage/delete/bucket-1/file.pdf',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should throw error when delete fails', async () => {
      const errorResponse = { error: 'File not found' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(StorageService.deleteFile('test-token', 'bucket-1', 'file.pdf'))
        .rejects.toThrow('Operación falló! Status: 404');
    });
  });

  describe('getPublicUrl', () => {
    const mockUrlResponse = {
      url: 'https://example.com/public/file.pdf'
    };

    it('should successfully get public URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUrlResponse)
      });

      const result = await StorageService.getPublicUrl('test-token', 'bucket-1', 'file.pdf');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/storage/url/bucket-1/file.pdf',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );

      expect(result).toBe('https://example.com/public/file.pdf');
    });

    it('should throw error when get URL fails', async () => {
      const errorResponse = { error: 'Access denied' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(StorageService.getPublicUrl('test-token', 'bucket-1', 'file.pdf'))
        .rejects.toThrow('Operación falló! Status: 403');
    });
  });

  describe('validateFile', () => {
    it('should not throw error for valid PDF file', () => {
      const validFile = new File(['x'.repeat(1024 * 1024)], 'document.pdf', { type: 'application/pdf' });

      expect(() => StorageService.validateFile(validFile)).not.toThrow();
    });

    it('should not throw error for valid JPG file', () => {
      const validFile = new File(['x'.repeat(2 * 1024 * 1024)], 'image.jpg', { type: 'image/jpeg' });

      expect(() => StorageService.validateFile(validFile)).not.toThrow();
    });

    it('should not throw error for valid PNG file', () => {
      const validFile = new File(['x'.repeat(1024 * 1024)], 'image.png', { type: 'image/png' });

      expect(() => StorageService.validateFile(validFile)).not.toThrow();
    });

    it('should throw error when file is null or undefined', () => {
      expect(() => StorageService.validateFile(null as any)).toThrow('Archivo requerido');
      expect(() => StorageService.validateFile(undefined as any)).toThrow('Archivo requerido');
    });

    it('should throw error when file size exceeds 5MB', () => {
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

      expect(() => StorageService.validateFile(largeFile)).toThrow('El archivo no puede superar los 5MB');
    });

    it('should throw error for unsupported file type', () => {
      const invalidFile = new File(['test'], 'document.pdf', { type: 'text/plain' });

      expect(() => StorageService.validateFile(invalidFile)).toThrow('Tipo de archivo no válido. Solo se permiten archivos PDF, JPG y PNG');
    });

    it('should throw error for file without extension', () => {
      const invalidFile = new File(['test'], 'document', { type: 'application/pdf' });

      expect(() => StorageService.validateFile(invalidFile)).toThrow('Extensión de archivo no válida. Solo se permiten: PDF, JPG, PNG');
    });

    it('should throw error for unsupported extension', () => {
      const invalidFile = new File(['test'], 'document.txt', { type: 'text/plain' });

      expect(() => StorageService.validateFile(invalidFile)).toThrow('Extensión de archivo no válida. Solo se permiten: PDF, JPG, PNG');
    });

    it('should not throw error for uppercase extension with valid mime type', () => {
      const validFile = new File(['test'], 'document.PDF', { type: 'application/pdf' });

      expect(() => StorageService.validateFile(validFile)).not.toThrow();
    });
  });
});