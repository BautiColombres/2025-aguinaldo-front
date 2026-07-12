import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FollowUpService } from './follow-up-service.service';
import type { FollowUpReminder, DueForFollowUp } from '../models/FollowUpReminder';

vi.mock('../../config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:8080',
    ENDPOINTS: {
      CREATE_FOLLOWUP: '/api/doctors/{doctorId}/medical-history/{historyId}/followup',
      GET_FOLLOWUPS: '/api/doctors/{doctorId}/followups',
      DISMISS_FOLLOWUP: '/api/doctors/{doctorId}/followups/{reminderId}/dismiss',
      GET_PATIENT_FOLLOWUPS: '/api/patients/{patientId}/followups',
      GET_DUE_FOR_FOLLOWUP: '/api/doctors/{doctorId}/patients/due-for-followup',
    },
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json',
    },
  },
  buildApiUrl: vi.fn((endpoint: string) => `http://localhost:8080${endpoint}`),
  getAuthenticatedFetchOptions: vi.fn((token: string) => ({
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FollowUpService', () => {
  const accessToken = 'access-token-123';
  const doctorId = 'doctor-1';
  const patientId = 'patient-1';
  const historyId = 'history-1';
  const reminderId = 'reminder-1';

  const mockReminder: FollowUpReminder = {
    id: 'reminder-1',
    patientId: 'patient-1',
    patientName: 'John',
    patientSurname: 'Doe',
    doctorId: 'doctor-1',
    historyId: 'history-1',
    turnId: 'turn-1',
    monthsUntilControl: 3,
    scheduledFor: '2024-08-10',
    dismissed: false,
    createdAt: '2024-05-10T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createReminder', () => {
    it('POSTs to the create-followup URL with the months-only payload and auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReminder),
      });

      const result = await FollowUpService.createReminder(accessToken, doctorId, historyId, 3);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/medical-history/history-1/followup',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ monthsUntilControl: 3 }),
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockReminder);
    });

    it('sends ONLY monthsUntilControl in the body (no patient/doctor/scheduledFor)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockReminder) });

      await FollowUpService.createReminder(accessToken, doctorId, historyId, 6);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ monthsUntilControl: 6 });
    });

    it('throws the server error message on a 409 duplicate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Ya existe un recordatorio activo' }),
      });

      await expect(FollowUpService.createReminder(accessToken, doctorId, historyId, 3))
        .rejects.toThrow('Ya existe un recordatorio activo');
    });

    it('throws a default error when the body carries no details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(FollowUpService.createReminder(accessToken, doctorId, historyId, 3))
        .rejects.toThrow('Failed to create follow-up reminder! Status: 500');
    });
  });

  describe('getDueReminders', () => {
    it('GETs the doctor followups URL and parses the list', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockReminder]) });

      const result = await FollowUpService.getDueReminders(accessToken, doctorId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/followups',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
        }),
      );
      expect(result).toEqual([mockReminder]);
    });

    it('throws the mapped error body on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Unauthorized access' }),
      });

      await expect(FollowUpService.getDueReminders(accessToken, doctorId))
        .rejects.toThrow('Unauthorized access');
    });
  });

  describe('dismissReminder', () => {
    it('PUTs to the dismiss URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await expect(FollowUpService.dismissReminder(accessToken, doctorId, reminderId))
        .resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/followups/reminder-1/dismiss',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
        }),
      );
    });

    it('throws the mapped error body on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Reminder not found' }),
      });

      await expect(FollowUpService.dismissReminder(accessToken, doctorId, reminderId))
        .rejects.toThrow('Reminder not found');
    });
  });

  describe('getDueForFollowUp', () => {
    const mockDue: DueForFollowUp = {
      patientId: 'patient-1',
      patientName: 'John',
      patientSurname: 'Doe',
      scheduledFor: '2024-08-10',
      lastTurnDate: '2024-05-10T10:00:00Z',
    };

    it('GETs the due-for-followup URL with the auth header and parses the list', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockDue]) });

      const result = await FollowUpService.getDueForFollowUp(accessToken, doctorId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/patients/due-for-followup',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
        }),
      );
      expect(result).toEqual([mockDue]);
    });

    it('returns an empty array when no patients are due', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      const result = await FollowUpService.getDueForFollowUp(accessToken, doctorId);
      expect(result).toEqual([]);
    });

    it('throws the mapped error body on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Unauthorized access' }),
      });

      await expect(FollowUpService.getDueForFollowUp(accessToken, doctorId))
        .rejects.toThrow('Unauthorized access');
    });

    it('throws a default error when the body carries no details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(FollowUpService.getDueForFollowUp(accessToken, doctorId))
        .rejects.toThrow('Failed to get patients due for follow-up! Status: 500');
    });
  });

  describe('getPatientReminders', () => {
    it('GETs the patient followups URL and parses the generic list', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockReminder]) });

      const result = await FollowUpService.getPatientReminders(accessToken, patientId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/patients/patient-1/followups',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
        }),
      );
      expect(result).toEqual([mockReminder]);
    });

    it('returns an empty array when the patient has no reminders', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      const result = await FollowUpService.getPatientReminders(accessToken, patientId);
      expect(result).toEqual([]);
    });

    it('throws the mapped error body on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Unauthorized access' }),
      });

      await expect(FollowUpService.getPatientReminders(accessToken, patientId))
        .rejects.toThrow('Unauthorized access');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(FollowUpService.getPatientReminders(accessToken, patientId))
        .rejects.toThrow('Network connection failed');
    });
  });
});
