import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type { 
  MedicalHistory, 
  CreateMedicalHistoryRequest, 
  UpdateMedicalHistoryContentRequest,
  ApiErrorResponse 
} from '../models/MedicalHistory';

export class MedicalHistoryService {
  /**
   * Add a new medical history entry for a patient
   */
  static async addMedicalHistory(
    accessToken: string, 
    doctorId: string, 
    request: CreateMedicalHistoryRequest
  ): Promise<MedicalHistory> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.ADD_MEDICAL_HISTORY.replace('{doctorId}', doctorId));

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
          `Failed to add medical history! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to add medical history:', error);
      throw error;
    }
  }

  /**
   * Update an existing medical history entry
   */
  static async updateMedicalHistory(
    accessToken: string, 
    doctorId: string, 
    historyId: string,
    request: UpdateMedicalHistoryContentRequest
  ): Promise<MedicalHistory> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.UPDATE_MEDICAL_HISTORY_ENTRY
        .replace('{doctorId}', doctorId)
        .replace('{historyId}', historyId)
    );

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'PUT',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to update medical history! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to update medical history:', error);
      throw error;
    }
  }

  /**
   * Delete a medical history entry
   */
  static async deleteMedicalHistory(
    accessToken: string, 
    doctorId: string, 
    historyId: string
  ): Promise<void> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.DELETE_MEDICAL_HISTORY
        .replace('{doctorId}', doctorId)
        .replace('{historyId}', historyId)
    );

    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to delete medical history! Status: ${response.status}`
        );
      }
    } catch (error) {
      logger.error('Failed to delete medical history:', error);
      throw error;
    }
  }

  /**
   * Get all medical history entries created by a doctor
   */
  static async getDoctorMedicalHistoryEntries(
    accessToken: string, 
    doctorId: string
  ): Promise<MedicalHistory[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_MEDICAL_HISTORY.replace('{doctorId}', doctorId));

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
          `Failed to get doctor medical history! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get doctor medical history:', error);
      throw error;
    }
  }

  /**
   * Get all medical history entries for a patient
   */
  static async getPatientMedicalHistory(
    accessToken: string, 
    patientId: string
  ): Promise<MedicalHistory[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_PATIENT_MEDICAL_HISTORY.replace('{patientId}', patientId));

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
          `Failed to get patient medical history! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get patient medical history:', error);
      throw error;
    }
  }

  /**
   * Get medical history entries for a specific patient created by a specific doctor
   */
  static async getPatientMedicalHistoryByDoctor(
    accessToken: string, 
    doctorId: string, 
    patientId: string
  ): Promise<MedicalHistory[]> {
    const url = buildApiUrl(
      API_CONFIG.ENDPOINTS.GET_PATIENT_HISTORY_BY_DOCTOR
        .replace('{doctorId}', doctorId)
        .replace('{patientId}', patientId)
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
          `Failed to get patient medical history by doctor! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get patient medical history by doctor:', error);
      throw error;
    }
  }
}