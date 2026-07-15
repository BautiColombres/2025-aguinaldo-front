import { API_CONFIG, authenticatedFetch, buildApiUrl } from '../../config/api';
import { logger } from '../utils/logger';
import type {
    PendingDoctor,
    DoctorApprovalResponse,
    AdminStats,
    ApiErrorResponse
} from '../models/Admin';

export class AdminService {


  static async getPendingDoctors(accessToken: string): Promise<PendingDoctor[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_PENDING_DOCTORS);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch pending doctors! Status: ${response.status}`
        );
      }

      const result: PendingDoctor[] = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch pending doctors:', error);
      throw error;
    }
  }


  static async approveDoctor(doctorId: string, accessToken: string): Promise<DoctorApprovalResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.APPROVE_DOCTOR.replace('{doctorId}', doctorId));
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to approve doctor! Status: ${response.status}`
        );
      }

      const result: DoctorApprovalResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to approve doctor:', error);
      throw error;
    }
  }


  static async rejectDoctor(doctorId: string, accessToken: string): Promise<DoctorApprovalResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.REJECT_DOCTOR.replace('{doctorId}', doctorId));
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to reject doctor! Status: ${response.status}`
        );
      }

      const result: DoctorApprovalResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to reject doctor:', error);
      throw error;
    }
  }


  static async getAdminStats(accessToken: string): Promise<AdminStats> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_ADMIN_STATS);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch admin stats! Status: ${response.status}`
        );
      }

      const result: AdminStats = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch admin stats:', error);
      // Return default values if there's an error
      return {
        patients: 0,
        doctors: 0,
        pending: 0
      };
    }
  }

  static async getAdminRatings(accessToken: string): Promise<any> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_ADMIN_RATINGS);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch admin ratings! Status: ${response.status}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch admin ratings:', error);
      throw error;
    }
  }

  static async getSpecialties(accessToken: string): Promise<string[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_SPECIALTIES);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch specialties! Status: ${response.status}`
        );
      }

      const result: string[] = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch specialties:', error);
      throw error;
    }
  }
}