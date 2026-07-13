import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type {
  FollowUpReminder,
  CreateFollowUpReminderRequest,
  FollowUpMonths,
  DueForFollowUp,
} from '../models/FollowUpReminder';
import type { ApiErrorResponse } from '../models/MedicalHistory';

export class FollowUpService {
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
