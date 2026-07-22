import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';
import type { FollowUpReminder, DueForFollowUp } from '../models/FollowUpReminder';

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    sendToMachine: vi.fn(),
    registerMachine: vi.fn(),
  },
}));

vi.mock('../service/follow-up-service.service', () => ({
  FollowUpService: {
    createReminder: vi.fn(),
    getDueReminders: vi.fn(),
    dismissReminder: vi.fn(),
    getPatientReminders: vi.fn(),
    getDoctorPatientReminders: vi.fn(),
    getDueForFollowUp: vi.fn(),
  },
}));

import { followUpMachine, DUPLICATE_FOLLOWUP_MESSAGE } from './followUpMachine';
import { FollowUpService } from '../service/follow-up-service.service';
import { ApiError } from '../../config/api';
import { orchestrator } from '#/core/Orchestrator';

const due = (over: Partial<DueForFollowUp> = {}): DueForFollowUp => ({
  patientId: 'patient-1',
  patientName: 'John',
  patientSurname: 'Doe',
  scheduledFor: '2024-08-10',
  lastTurnDate: '2024-05-10T10:00:00Z',
  ...over,
});

const reminder = (over: Partial<FollowUpReminder> = {}): FollowUpReminder => ({
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
  ...over,
});

describe('followUpMachine', () => {
  let actor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    actor = createActor(followUpMachine);
    actor.start();
  });

  afterEach(() => {
    actor?.stop();
    vi.resetAllMocks();
  });

  it('starts in idle with empty context', () => {
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.dueReminders).toEqual([]);
    expect(actor.getSnapshot().context.dueForFollowUp).toEqual([]);
    expect(actor.getSnapshot().context.patientReminders).toEqual([]);
    expect(actor.getSnapshot().context.doctorPatientReminders).toEqual([]);
    expect(actor.getSnapshot().context.isLoading).toBe(false);
    expect(actor.getSnapshot().context.error).toBe(null);
  });

  describe('CREATE_FOLLOWUP', () => {
    it('calls the service with historyId/months and shows a success snackbar', async () => {
      vi.mocked(FollowUpService.createReminder).mockResolvedValueOnce(reminder());

      actor.send({
        type: 'CREATE_FOLLOWUP',
        historyId: 'history-1',
        months: 3,
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      });

      expect(actor.getSnapshot().value).toBe('creating');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.createReminder).toHaveBeenCalledWith('token-123', 'doctor-1', 'history-1', 3);
      expect(orchestrator.sendToMachine).toHaveBeenCalledWith(
        'ui',
        expect.objectContaining({ type: 'OPEN_SNACKBAR', severity: 'success' }),
      );
      expect(actor.getSnapshot().context.error).toBe(null);
    });

    // FBUG-002 — a duplicate reminder (backend dup-guard → 409) used to surface an
    // opaque/blank snackbar. The 409 is now detected structurally (status), never by
    // string-matching the backend prose, and mapped to its own localized copy.
    it('maps a 409 duplicate to the specific warning snackbar (FBUG-002)', async () => {
      vi.mocked(FollowUpService.createReminder).mockRejectedValueOnce(
        new ApiError('Active follow-up reminder already exists for this medical history', 409),
      );

      actor.send({
        type: 'CREATE_FOLLOWUP',
        historyId: 'history-1',
        months: 6,
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(orchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: DUPLICATE_FOLLOWUP_MESSAGE,
        severity: 'warning',
      });
      expect(DUPLICATE_FOLLOWUP_MESSAGE).toBe('Ya existe un recordatorio activo para esta consulta');
      expect(actor.getSnapshot().context.error).toBe(DUPLICATE_FOLLOWUP_MESSAGE);
    });

    it('keeps the generic error snackbar for a non-409 failure', async () => {
      vi.mocked(FollowUpService.createReminder).mockRejectedValueOnce(
        new ApiError('Internal server error', 500),
      );

      actor.send({
        type: 'CREATE_FOLLOWUP',
        historyId: 'history-1',
        months: 6,
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBe('Internal server error');
      expect(orchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: 'Internal server error',
        severity: 'error',
      });
      expect(orchestrator.sendToMachine).not.toHaveBeenCalledWith(
        'ui',
        expect.objectContaining({ severity: 'warning' }),
      );
    });

    it('falls back to a generic message when the rejection carries no message', async () => {
      vi.mocked(FollowUpService.createReminder).mockRejectedValueOnce('boom');

      actor.send({
        type: 'CREATE_FOLLOWUP',
        historyId: 'history-1',
        months: 3,
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBe('Error al crear el recordatorio de control');
      expect(orchestrator.sendToMachine).toHaveBeenCalledWith(
        'ui',
        expect.objectContaining({ type: 'OPEN_SNACKBAR', severity: 'error' }),
      );
    });
  });

  describe('LOAD_DUE_FOLLOWUPS', () => {
    it('populates dueReminders on success', async () => {
      const list = [reminder({ id: 'r1' }), reminder({ id: 'r2', patientId: 'patient-2' })];
      vi.mocked(FollowUpService.getDueReminders).mockResolvedValueOnce(list);

      actor.send({ type: 'LOAD_DUE_FOLLOWUPS', doctorId: 'doctor-1', accessToken: 'token-123' });

      expect(actor.getSnapshot().value).toBe('loadingDue');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.getDueReminders).toHaveBeenCalledWith('token-123', 'doctor-1');
      expect(actor.getSnapshot().context.dueReminders).toEqual(list);
    });

    it('sets an error and preserves the list on failure', async () => {
      vi.mocked(FollowUpService.getDueReminders).mockRejectedValueOnce(new Error('boom'));

      actor.send({ type: 'LOAD_DUE_FOLLOWUPS', doctorId: 'doctor-1', accessToken: 'token-123' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBeTruthy();
      expect(actor.getSnapshot().context.dueReminders).toEqual([]);
    });
  });

  describe('LOAD_DUE_FOR_FOLLOWUP', () => {
    it('populates dueForFollowUp on success', async () => {
      const list = [due({ patientId: 'p1' }), due({ patientId: 'p2', patientName: 'Jane' })];
      vi.mocked(FollowUpService.getDueForFollowUp).mockResolvedValueOnce(list);

      actor.send({ type: 'LOAD_DUE_FOR_FOLLOWUP', doctorId: 'doctor-1', accessToken: 'token-123' });

      expect(actor.getSnapshot().value).toBe('loadingDueForFollowUp');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.getDueForFollowUp).toHaveBeenCalledWith('token-123', 'doctor-1');
      expect(actor.getSnapshot().context.dueForFollowUp).toEqual(list);
      expect(actor.getSnapshot().context.error).toBe(null);
    });

    it('sets an error and preserves the list on failure', async () => {
      vi.mocked(FollowUpService.getDueForFollowUp).mockRejectedValueOnce(new Error('boom'));

      actor.send({ type: 'LOAD_DUE_FOR_FOLLOWUP', doctorId: 'doctor-1', accessToken: 'token-123' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBeTruthy();
      expect(actor.getSnapshot().context.dueForFollowUp).toEqual([]);
    });
  });

  describe('DISMISS_FOLLOWUP', () => {
    it('removes the dismissed reminder from dueReminders', async () => {
      const list = [reminder({ id: 'r1' }), reminder({ id: 'r2' })];
      vi.mocked(FollowUpService.getDueReminders).mockResolvedValueOnce(list);
      actor.send({ type: 'LOAD_DUE_FOLLOWUPS', doctorId: 'doctor-1', accessToken: 'token-123' });
      await vi.waitFor(() => expect(actor.getSnapshot().context.dueReminders).toHaveLength(2));

      vi.mocked(FollowUpService.dismissReminder).mockResolvedValueOnce(undefined);
      actor.send({ type: 'DISMISS_FOLLOWUP', reminderId: 'r1', doctorId: 'doctor-1', accessToken: 'token-123' });

      expect(actor.getSnapshot().value).toBe('dismissing');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.dismissReminder).toHaveBeenCalledWith('token-123', 'doctor-1', 'r1');
      expect(actor.getSnapshot().context.dueReminders.map((r: FollowUpReminder) => r.id)).toEqual(['r2']);
    });
  });

  describe('LOAD_PATIENT_FOLLOWUPS', () => {
    it('populates patientReminders on success', async () => {
      const list = [reminder({ id: 'p1' })];
      vi.mocked(FollowUpService.getPatientReminders).mockResolvedValueOnce(list);

      actor.send({ type: 'LOAD_PATIENT_FOLLOWUPS', patientId: 'patient-1', accessToken: 'token-123' });

      expect(actor.getSnapshot().value).toBe('loadingPatientReminders');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.getPatientReminders).toHaveBeenCalledWith('token-123', 'patient-1');
      expect(actor.getSnapshot().context.patientReminders).toEqual(list);
    });

    it('sets an error and preserves patientReminders on failure', async () => {
      vi.mocked(FollowUpService.getPatientReminders).mockRejectedValueOnce(new Error('nope'));

      actor.send({ type: 'LOAD_PATIENT_FOLLOWUPS', patientId: 'patient-1', accessToken: 'token-123' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBeTruthy();
      expect(actor.getSnapshot().context.patientReminders).toEqual([]);
    });
  });

  describe('LOAD_DOCTOR_PATIENT_FOLLOWUPS', () => {
    it('populates doctorPatientReminders on success without clobbering patientReminders', async () => {
      const list = [reminder({ id: 'd1', historyId: 'history-1' })];
      vi.mocked(FollowUpService.getDoctorPatientReminders).mockResolvedValueOnce(list);

      actor.send({
        type: 'LOAD_DOCTOR_PATIENT_FOLLOWUPS',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        accessToken: 'token-123',
      });

      expect(actor.getSnapshot().value).toBe('loadingDoctorPatientReminders');

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(FollowUpService.getDoctorPatientReminders).toHaveBeenCalledWith('token-123', 'doctor-1', 'patient-1');
      expect(actor.getSnapshot().context.doctorPatientReminders).toEqual(list);
      // The patient-role field must remain untouched.
      expect(actor.getSnapshot().context.patientReminders).toEqual([]);
    });

    it('sets an error and preserves doctorPatientReminders on failure', async () => {
      vi.mocked(FollowUpService.getDoctorPatientReminders).mockRejectedValueOnce(new Error('nope'));

      actor.send({
        type: 'LOAD_DOCTOR_PATIENT_FOLLOWUPS',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        accessToken: 'token-123',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.error).toBeTruthy();
      expect(actor.getSnapshot().context.doctorPatientReminders).toEqual([]);
    });
  });
});
