import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type {
  FollowUpReminder,
  CreateFollowUpReminderRequest,
  FollowUpMonths,
  DueForFollowUp,
} from '../models/FollowUpReminder';
import type { ApiErrorResponse } from '../models/MedicalHistory';

/**
 * Phase F2 — follow-up reminder network layer. All calls go through
 * `config/api.ts` (`buildApiUrl` + `getAuthenticatedFetchOptions`), mirroring
 * `MedicalHistoryService`. Error bodies are mapped to a thrown Error.
 */
export class FollowUpService {
  /**
   * Create a "control en X meses" reminder for a note. The request body carries
   * the interval ONLY — patient/doctor/scheduledFor are derived server-side.
   */
  static async createReminder(
    accessToken: string,
    doctorId: string,
    historyId: string,
    months: FollowUpMonths,
  ): Promise<FollowUpReminder> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.CREATE_FOLLOWUP
        .replace('{doctorId}', doctorId)
        .replace('{historyId}', historyId),
    );

    const request: CreateFollowUpReminderRequest = { monthsUntilControl: months };

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            `Failed to create follow-up reminder! Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to create follow-up reminder:', error);
      throw error;
    }
  }

  /**
   * Get the doctor's due reminders ("due + no future turn"). No overdue field.
   */
  static async getDueReminders(
    accessToken: string,
    doctorId: string,
  ): Promise<FollowUpReminder[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_FOLLOWUPS.replace('{doctorId}', doctorId));

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            `Failed to get follow-up reminders! Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get follow-up reminders:', error);
      throw error;
    }
  }

  /**
   * Dismiss a reminder (ownership-scoped server-side).
   */
  static async dismissReminder(
    accessToken: string,
    doctorId: string,
    reminderId: string,
  ): Promise<void> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.DISMISS_FOLLOWUP
        .replace('{doctorId}', doctorId)
        .replace('{reminderId}', reminderId),
    );

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'PUT',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            `Failed to dismiss follow-up reminder! Status: ${response.status}`,
        );
      }
    } catch (error) {
      logger.error('Failed to dismiss follow-up reminder:', error);
      throw error;
    }
  }

  /**
   * Phase F3 — patients who should return and have no upcoming turn. Per OQ-4
   * the DTO carries only the recommended control date (`scheduledFor`) and the
   * last attended turn (`lastTurnDate`); no overdue field.
   */
  static async getDueForFollowUp(
    accessToken: string,
    doctorId: string,
  ): Promise<DueForFollowUp[]> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.GET_DUE_FOR_FOLLOWUP.replace('{doctorId}', doctorId),
    );

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            `Failed to get patients due for follow-up! Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get patients due for follow-up:', error);
      throw error;
    }
  }

  /**
   * Patient-owned read: the patient's own non-dismissed reminders (generic DTO,
   * no clinical tag/motive).
   */
  static async getPatientReminders(
    accessToken: string,
    patientId: string,
  ): Promise<FollowUpReminder[]> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.GET_PATIENT_FOLLOWUPS.replace('{patientId}', patientId),
    );

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            `Failed to get patient follow-up reminders! Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get patient follow-up reminders:', error);
      throw error;
    }
  }
}
