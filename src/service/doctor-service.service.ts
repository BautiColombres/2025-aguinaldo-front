import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type { Patient, ApiErrorResponse } from '../models/Doctor';

export interface TimeRange {
  start: string;
  end: string;
}

export interface DayAvailability {
  day: string;
  enabled: boolean;
  ranges: TimeRange[];
}

export interface DoctorAvailabilityRequest {
  weeklyAvailability: DayAvailability[];
}

export interface DoctorAvailabilityResponse {
  slotDurationMin: number;
  weeklyAvailability: DayAvailability[];
}

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
}

export interface SubcategoryCount {
  subcategory: string;
  count: number;
}

export interface DoctorMetrics {
  doctorId: string;
  name: string;
  surname: string;
  specialty: string;
  score: number | null;
  ratingSubcategories: SubcategoryCount[];
  totalPatients: number;
  upcomingTurns: number;
  completedTurnsThisMonth: number;
  cancelledTurns: number;
}

export class DoctorService {
  
  static async getDoctorPatients(accessToken: string, doctorId: string): Promise<Patient[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_PATIENTS.replace('{doctorId}', doctorId));
    
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
          `Failed to fetch doctor patients! Status: ${response.status}`
        );
      }

      const result: Patient[] = await  response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch doctor patients:', error);
      throw error;
    }
  }

  static async saveAvailability(accessToken: string, doctorId: string, availability: DoctorAvailabilityRequest): Promise<void> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_DOCTOR_AVAILABILITY.replace('{doctorId}', doctorId));
    
    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'POST',
        body: JSON.stringify(availability),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to save availability! Status: ${response.status}`
        );
      }
    } catch (error) {
      logger.error('Failed to save availability:', error);
      throw error;
    }
  }

  static async getAvailability(accessToken: string, doctorId: string): Promise<DoctorAvailabilityResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_AVAILABILITY.replace('{doctorId}', doctorId));
    
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
          `Failed to fetch availability! Status: ${response.status}`
        );
      }

      const result: DoctorAvailabilityResponse = await  response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch availability:', error);
      throw error;
    }
  }

  static async getAvailableSlots(accessToken: string, doctorId: string, fromDate: string, toDate: string): Promise<AvailableSlot[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_AVAILABLE_SLOTS.replace('{doctorId}', doctorId) + `?fromDate=${fromDate}&toDate=${toDate}`);
    
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
          `Failed to fetch available slots! Status: ${response.status}`
        );
      }

      const result: AvailableSlot[] = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch available slots:', error);
      throw error;
    }
  }

  // Note: Medical history operations have been moved to MedicalHistoryService
  // Use MedicalHistoryService.addMedicalHistory(), updateMedicalHistory(), etc.

  static async getDoctorMetrics(accessToken: string, doctorId: string): Promise<DoctorMetrics> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_METRICS.replace('{doctorId}', doctorId));
    
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
          `Failed to fetch doctor metrics! Status: ${response.status}`
        );
      }

      const result: DoctorMetrics = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch doctor metrics:', error);
      throw error;
    }
  }

}