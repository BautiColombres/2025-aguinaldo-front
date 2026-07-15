import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DoctorService } from './doctor-service.service';
import type { Patient } from '../models/Doctor';

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
    BASE_URL: 'http://localhost:8080',
    ENDPOINTS: {
      GET_DOCTOR_PATIENTS: '/api/doctors/{doctorId}/patients',
      SAVE_DOCTOR_AVAILABILITY: '/api/doctors/{doctorId}/availability',
      GET_DOCTOR_AVAILABLE_SLOTS: '/api/doctors/{doctorId}/available-slots',
      GET_DOCTOR_AVAILABILITY: '/api/doctors/{doctorId}/availability'
    },
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json'
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
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DoctorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getDoctorPatients', () => {
    const accessToken = 'access-token-123';
    const doctorId = 'doctor-1';
    const mockPatients: Patient[] = [
      {
        id: '1',
        name: 'John',
        surname: 'Doe',
        email: 'john.doe@example.com',
        dni: 12345678,
        phone: '123456789',
        birthdate: '1990-01-01',
        gender: 'M',
        status: 'ACTIVE',
        medicalHistory: 'No known allergies'
      },
      {
        id: '2',
        name: 'Jane',
        surname: 'Smith',
        email: 'jane.smith@example.com',
        dni: 87654321,
        phone: '987654321',
        birthdate: '1985-05-15',
        gender: 'F',
        status: 'ACTIVE'
      }
    ];

    it('should successfully fetch doctor patients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPatients)
      });

      const result = await DoctorService.getDoctorPatients(accessToken, doctorId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/patients',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockPatients);
    });

    it('should throw error when patients fetch fails', async () => {
      const errorResponse = { message: 'Doctor not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(DoctorService.getDoctorPatients(accessToken, doctorId))
        .rejects.toThrow('Doctor not found');
    });

    it('should throw error with default message when patients fetch fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(DoctorService.getDoctorPatients(accessToken, doctorId))
        .rejects.toThrow('Failed to fetch doctor patients! Status: 500');
    });

    it('should throw error when fetch fails during patients fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(DoctorService.getDoctorPatients(accessToken, doctorId))
        .rejects.toThrow('Network error');
    });

    it('should throw error when response.json() fails during patients fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(DoctorService.getDoctorPatients(accessToken, doctorId))
        .rejects.toThrow('Failed to fetch doctor patients! Status: 400');
    });
  });

  describe('saveAvailability', () => {
    const accessToken = 'access-token-123';
    const doctorId = 'doctor-1';
    const mockAvailability = {
      slotDurationMin: 30,
      weeklyAvailability: [
        {
          day: 'MONDAY',
          enabled: true,
          ranges: [
            { start: '09:00', end: '12:00' },
            { start: '14:00', end: '17:00' }
          ]
        },
        {
          day: 'TUESDAY',
          enabled: true,
          ranges: [
            { start: '10:00', end: '16:00' }
          ]
        }
      ]
    };

    it('should successfully save availability', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(DoctorService.saveAvailability(accessToken, doctorId, mockAvailability))
        .resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/availability',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockAvailability)
        })
      );
    });

    it('should throw error when availability save fails', async () => {
      const errorResponse = { message: 'Invalid availability data' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(DoctorService.saveAvailability(accessToken, doctorId, mockAvailability))
        .rejects.toThrow('Invalid availability data');
    });

    it('should throw error with default message when availability save fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(DoctorService.saveAvailability(accessToken, doctorId, mockAvailability))
        .rejects.toThrow('Failed to save availability! Status: 500');
    });

    it('should throw error when fetch fails during availability save', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(DoctorService.saveAvailability(accessToken, doctorId, mockAvailability))
        .rejects.toThrow('Network error');
    });
  });

  describe('getAvailability', () => {
    const accessToken = 'access-token-123';
    const doctorId = 'doctor-1';
    const mockAvailabilityResponse = {
      slotDurationMin: 30,
      weeklyAvailability: [
        {
          day: 'MONDAY',
          enabled: true,
          ranges: [
            { start: '09:00', end: '12:00' },
            { start: '14:00', end: '17:00' }
          ]
        },
        {
          day: 'TUESDAY',
          enabled: true,
          ranges: [
            { start: '10:00', end: '16:00' }
          ]
        }
      ]
    };

    it('should successfully fetch availability', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvailabilityResponse)
      });

      const result = await DoctorService.getAvailability(accessToken, doctorId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/availability',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockAvailabilityResponse);
    });

    it('should throw error when availability fetch fails', async () => {
      const errorResponse = { message: 'Doctor not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(DoctorService.getAvailability(accessToken, doctorId))
        .rejects.toThrow('Doctor not found');
    });

    it('should throw error with default message when availability fetch fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(DoctorService.getAvailability(accessToken, doctorId))
        .rejects.toThrow('Failed to fetch availability! Status: 500');
    });

    it('should throw error when fetch fails during availability fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(DoctorService.getAvailability(accessToken, doctorId))
        .rejects.toThrow('Network error');
    });
  });

  describe('getAvailableSlots', () => {
    const accessToken = 'access-token-123';
    const doctorId = 'doctor-1';
    const fromDate = '2024-01-01';
    const toDate = '2024-01-07';
    const mockAvailableSlots = [
      {
        date: '2024-01-01',
        startTime: '09:00',
        endTime: '09:30',
        dayOfWeek: 'MONDAY'
      },
      {
        date: '2024-01-01',
        startTime: '09:30',
        endTime: '10:00',
        dayOfWeek: 'MONDAY'
      },
      {
        date: '2024-01-02',
        startTime: '10:00',
        endTime: '10:30',
        dayOfWeek: 'TUESDAY'
      }
    ];

    it('should successfully fetch available slots', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvailableSlots)
      });

      const result = await DoctorService.getAvailableSlots(accessToken, doctorId, fromDate, toDate);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/available-slots?fromDate=2024-01-01&toDate=2024-01-07',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockAvailableSlots);
    });

    it('should throw error when available slots fetch fails', async () => {
      const errorResponse = { message: 'Invalid date range' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(DoctorService.getAvailableSlots(accessToken, doctorId, fromDate, toDate))
        .rejects.toThrow('Invalid date range');
    });

    it('should throw error with default message when available slots fetch fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(DoctorService.getAvailableSlots(accessToken, doctorId, fromDate, toDate))
        .rejects.toThrow('Failed to fetch available slots! Status: 500');
    });

    it('should throw error when fetch fails during available slots fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(DoctorService.getAvailableSlots(accessToken, doctorId, fromDate, toDate))
        .rejects.toThrow('Network error');
    });
  });
});