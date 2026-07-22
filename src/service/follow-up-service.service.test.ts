import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FollowUpService } from './follow-up-service.service';
import { ApiError, classifyApiError, isConflictError } from '../../config/api';
import type { FollowUpReminder, DueForFollowUp } from '../models/FollowUpReminder';

// FBUG-003 — this suite runs against the REAL config/api so the centralized
// `authenticatedFetch` interceptor (401 → refresh → retry) is exercised end to
// end from a migrated service. Only the orchestrator (machine broadcast) is mocked.
const { orchestratorSend } = vi.hoisted(() => ({ orchestratorSend: vi.fn() }));

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: orchestratorSend,
    sendToMachine: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const REFRESH_URL = 'http://localhost:8080/api/auth/refresh-token';

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

    // FBUG-002 — the duplicate-reminder guard (409) must be identifiable STRUCTURALLY
    // (status/kind), never by string-matching the backend's wording, so the machine
    // can map it to its own localized copy.
    it('tags a 409 duplicate with status 409 so callers can identify it (FBUG-002)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'CONFLICT', message: 'whatever the backend says' }),
      });

      const error = await FollowUpService.createReminder(accessToken, doctorId, historyId, 3)
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect(isConflictError(error)).toBe(true);
      expect(classifyApiError(error).kind).toBe('conflict');
    });

    it('does NOT tag a non-409 failure as a conflict', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Boom' }),
      });

      const error = await FollowUpService.createReminder(accessToken, doctorId, historyId, 3)
        .then(() => null)
        .catch((e: unknown) => e);

      expect((error as ApiError).status).toBe(500);
      expect(isConflictError(error)).toBe(false);
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

  describe('getDoctorPatientReminders', () => {
    it('GETs the doctor-scoped patient followups URL and parses the list', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockReminder]) });

      const result = await FollowUpService.getDoctorPatientReminders(accessToken, doctorId, patientId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/doctors/doctor-1/patients/patient-1/followups',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
        }),
      );
      expect(result).toEqual([mockReminder]);
    });

    it('returns an empty array when the doctor scheduled no reminders for the patient', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      const result = await FollowUpService.getDoctorPatientReminders(accessToken, doctorId, patientId);
      expect(result).toEqual([]);
    });

    it('throws the mapped error body on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Unauthorized access' }),
      });

      await expect(FollowUpService.getDoctorPatientReminders(accessToken, doctorId, patientId))
        .rejects.toThrow('Unauthorized access');
    });
  });

  // FBUG-003 — a mid-session access-token expiry used to drop the action silently.
  // Every service now goes through the centralized interceptor, so a 401 triggers
  // a refresh and the original request is retried transparently.
  describe('expired access token (FBUG-003)', () => {
    const freshToken = 'fresh-access-token';

    it('refreshes the token and retries the create, returning the created reminder', async () => {
      mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
        if (url === REFRESH_URL) {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'doctor-1', role: 'DOCTOR', status: 'ACTIVE', accessToken: freshToken }),
          };
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === `Bearer ${freshToken}`
          ? { ok: true, status: 200, json: () => Promise.resolve(mockReminder) }
          : { ok: false, status: 401, json: () => Promise.resolve({ message: 'Unauthorized' }) };
      });

      const result = await FollowUpService.createReminder(accessToken, doctorId, historyId, 3);

      expect(result).toEqual(mockReminder);
      expect(mockFetch.mock.calls.filter(([url]) => url === REFRESH_URL)).toHaveLength(1);
      expect(orchestratorSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TOKEN_REFRESHED', accessToken: freshToken }),
      );
    });

    it('surfaces the error and signals SESSION_EXPIRED when the refresh fails', async () => {
      mockFetch.mockImplementation(async () => ({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      }));

      await expect(FollowUpService.getDueReminders(accessToken, doctorId))
        .rejects.toThrow('Unauthorized');

      expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' });
    });
  });
});
