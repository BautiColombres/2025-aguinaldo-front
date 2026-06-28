import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// FSEC-H2 — Plaintext http:// API base URL fallback.
// BASE_URL resolution is evaluated at module load, so each test stubs the
// relevant import.meta.env values, resets the module registry, and dynamically
// re-imports config/api to force re-evaluation under the stubbed environment.

const importApi = async () => await import('./api');

describe('config/api BASE_URL resolution (FSEC-H2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('in DEV', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('allows http://localhost', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://localhost:8080');
    });

    it('allows http://127.0.0.1', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8080');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://127.0.0.1:8080');
    });

    it('falls back to http://localhost:8080 when the env var is missing', async () => {
      vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://localhost:8080');
    });

    it('allows an https URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.medibook.example');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('https://api.medibook.example');
    });

    it('rejects a non-localhost http URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://api.medibook.example');
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });
  });

  describe('outside DEV (production)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', false);
    });

    it('accepts an https URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.medibook.example');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('https://api.medibook.example');
    });

    it('rejects a missing env var', async () => {
      vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });

    it('rejects an empty env var', async () => {
      vi.stubEnv('VITE_API_BASE_URL', '');
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });

    it('rejects a plaintext http URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://api.medibook.example');
      await expect(importApi()).rejects.toThrow(/https/);
    });

    it('rejects http://localhost (no insecure fallback in production)', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
      await expect(importApi()).rejects.toThrow(/https/);
    });
  });

  it('preserves the public module shape (buildApiUrl, endpoints, auth options)', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    const mod = await importApi();
    expect(typeof mod.buildApiUrl).toBe('function');
    expect(typeof mod.getAuthenticatedFetchOptions).toBe('function');
    expect(mod.API_CONFIG.ENDPOINTS.SIGNIN).toBe('/api/auth/signin');
    expect(mod.buildApiUrl('/api/auth/signin')).toBe('http://localhost:8080/api/auth/signin');
  });
});
