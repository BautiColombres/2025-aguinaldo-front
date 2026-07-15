import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TurnModifyService } from './turn-modify-service.service';
import type { TurnModifyRequest } from '../models/TurnModifyRequest';

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
  API_CONFIG: {
    ENDPOINTS: {
      MODIFY_TURN_REQUEST: '/api/turns/modify',
      GET_MY_MODIFY_REQUESTS: '/api/turns/modify/my-requests'
    }
  },
  buildApiUrl: vi.fn((endpoint: string) => `http://localhost:8080${endpoint}`),
  getAuthenticatedFetchOptions: vi.fn((token: string) => ({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }))
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TurnModifyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createModifyRequest', () => {
    const accessToken = 'access-token-123';
    const mockCreateRequest = {
      turnId: 'turn-1',
      newScheduledAt: '2024-01-15T10:00:00Z'
    };

    const mockModifyRequest: TurnModifyRequest = {
      id: 'modify-1',
      turnId: 'turn-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      currentScheduledAt: '2024-01-10T10:00:00Z',
      requestedScheduledAt: '2024-01-15T10:00:00Z',
      status: 'PENDING'
    };

    it('should successfully create modify request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModifyRequest)
      });

      const result = await TurnModifyService.createModifyRequest(mockCreateRequest, accessToken);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/modify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockCreateRequest)
        })
      );
      expect(result).toEqual(mockModifyRequest);
    });

    it('should throw error when create request fails', async () => {
      const errorResponse = { message: 'Turn not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(TurnModifyService.createModifyRequest(mockCreateRequest, accessToken))
        .rejects.toThrow('Turn not found');
    });

    it('should throw error with default message when create fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(TurnModifyService.createModifyRequest(mockCreateRequest, accessToken))
        .rejects.toThrow('Failed to create modify request! Status: 500');
    });

    it('should throw error when fetch fails during create', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(TurnModifyService.createModifyRequest(mockCreateRequest, accessToken))
        .rejects.toThrow('Network error');
    });

    it('should throw error when response.json() fails during create', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(TurnModifyService.createModifyRequest(mockCreateRequest, accessToken))
        .rejects.toThrow('Failed to create modify request! Status: 400');
    });
  });

  describe('getMyModifyRequests', () => {
    const accessToken = 'access-token-123';
    const mockModifyRequests: TurnModifyRequest[] = [
      {
        id: 'modify-1',
        turnId: 'turn-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        currentScheduledAt: '2024-01-10T10:00:00Z',
        requestedScheduledAt: '2024-01-15T10:00:00Z',
        status: 'PENDING'
      },
      {
        id: 'modify-2',
        turnId: 'turn-2',
        patientId: 'patient-1',
        doctorId: 'doctor-2',
        currentScheduledAt: '2024-01-12T14:00:00Z',
        requestedScheduledAt: '2024-01-16T14:00:00Z',
        status: 'APPROVED'
      }
    ];

    it('should successfully fetch my modify requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModifyRequests)
      });

      const result = await TurnModifyService.getMyModifyRequests(accessToken);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/modify/my-requests',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockModifyRequests);
    });

    it('should throw error when fetch requests fails', async () => {
      const errorResponse = { message: 'Unauthorized' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(TurnModifyService.getMyModifyRequests(accessToken))
        .rejects.toThrow('Unauthorized');
    });

    it('should throw error with default message when fetch fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(TurnModifyService.getMyModifyRequests(accessToken))
        .rejects.toThrow('Failed to fetch modify requests! Status: 500');
    });

    it('should throw error when fetch fails during get requests', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(TurnModifyService.getMyModifyRequests(accessToken))
        .rejects.toThrow('Network error');
    });

    it('should throw error when response.json() fails during get requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(TurnModifyService.getMyModifyRequests(accessToken))
        .rejects.toThrow('Failed to fetch modify requests! Status: 400');
    });
  });
});