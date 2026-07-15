// FBUG-003 — the ad-hoc `handleAuthError()` that dispatched HANDLE_AUTH_ERROR with
// a never-invoked `retryAction` is gone: 401 → refresh → retry is now handled once,
// centrally, by `authenticatedFetch` (config/api).
import { API_CONFIG, authenticatedFetch, buildApiUrl, getDefaultFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import dayjs from '#/utils/dayjs.config';
import type {
  Doctor,
  TurnCreateRequest,
  TurnResponse,
  ApiErrorResponse
} from '../models/Turn';
import type { TurnModifyRequest } from '../models/TurnModifyRequest';

export class TurnService {
  static async getMyModifyRequests(accessToken: string): Promise<TurnModifyRequest[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_MY_MODIFY_REQUESTS);
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });
      
      
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        logger.error('[TurnService] getMyModifyRequests - Error:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch modify requests! Status: ${response.status}`
        );
      }
      const result: TurnModifyRequest[] = await response.json();
      return result;
    } catch (error) {
      logger.error('[TurnService] getMyModifyRequests - Exception:', error);
      throw error;
    }
  }

  static async getDoctorModifyRequests(doctorId: string, accessToken: string): Promise<TurnModifyRequest[]> {
    let url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_MODIFY_REQUESTS);
    url = url.replace('{doctorId}', doctorId);
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch doctor modify requests! Status: ${response.status}`
        );
      }

      const result: TurnModifyRequest[] = await response.json();
      return result;
    } catch (error) {
      logger.error('[TurnService] getDoctorModifyRequests - Exception:', error);
      throw error;
    }
  }

  static async getDoctors(accessToken: string): Promise<Doctor[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTORS);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch doctors! Status: ${response.status}`
        );
      }

      const result: Doctor[] = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getAvailableTurns(
    doctorId: string, 
    date: string, 
    accessToken: string
  ): Promise<string[]> {
    const url = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_AVAILABLE_TURNS}?doctorId=${doctorId}&date=${date}`);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch available turns! Status: ${response.status}`
        );
      }
      const availableTimes: string[] = await response.json();
      
      return availableTimes;
    } catch (error) {
      throw error;
    }
  }

  static async createTurn(
    data: TurnCreateRequest, 
    accessToken: string
  ): Promise<TurnResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_TURN);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to create turn! Status: ${response.status}`
        );
      }

      const result: TurnResponse = await response.json();
      
      return result;
    } catch (error) {
      throw error;
    }
  }
  
  static async getMyTurns(
    accessToken: string,
    status?: string
  ): Promise<TurnResponse[]> {
    const url = status 
      ? `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_MY_TURNS)}?status=${status}`
      : buildApiUrl(API_CONFIG.ENDPOINTS.GET_MY_TURNS);
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        logger.error('[TurnService] getMyTurns - Error:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch my turns! Status: ${response.status}`
        );
      }
      const result: TurnResponse[] = await response.json();
      return result;
    } catch (error) {
        logger.error('[TurnService] getMyTurns - Exception:', error);
      throw error;
    }
  }

  static async getPatientTurns(
    patientId: string,
    accessToken: string,
    status?: string
  ): Promise<TurnResponse[]> {
    const url = status 
      ? `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_PATIENT_TURNS)}/${patientId}?status=${status}`
      : `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_PATIENT_TURNS)}/${patientId}`;
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch patient turns! Status: ${response.status}`
        );
      }

      const result: TurnResponse[] = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getDoctorTurns(
    doctorId: string,
    accessToken: string,
    status?: string
  ): Promise<TurnResponse[]> {
    const url = status 
      ? `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_TURNS)}/${doctorId}?status=${status}`
      : `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_TURNS)}/${doctorId}`;
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch doctor turns! Status: ${response.status}`
        );
      }

      const result: TurnResponse[] = await  response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getAvailableDates(doctorId: string, accessToken: string): Promise<string[]> {
    const fromDate = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
    const toDate = dayjs().tz('America/Argentina/Buenos_Aires').add(60, 'day').format('YYYY-MM-DD');
    
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_DOCTOR_AVAILABLE_SLOTS.replace('{doctorId}', doctorId) + `?fromDate=${fromDate}&toDate=${toDate}`);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
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
      const slots: any[] = await response.json();
      // Extract unique dates from slots
      const dateSet = new Set<string>();
      slots.forEach(slot => {
        if (slot.date) {
          dateSet.add(slot.date);
        }
      });
      const dates: string[] = Array.from(dateSet).sort();
      return dates;
    } catch (error) {
      throw error;
    }
  }

  static async createModifyRequest(
    data: { turnId: string; newScheduledAt: string }, 
    accessToken: string
  ): Promise<any> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.MODIFY_TURN_REQUEST);
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to create modify request! Status: ${response.status}`
        );
      }
      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getDoctorAvailability(doctorId: string, accessToken: string): Promise<any> {
    try {
      const availableDates = await  TurnService.getAvailableDates(doctorId, accessToken);
      return { availableDates };
    } catch (error) {
      throw error;
    }
  }

  static async approveModifyRequest(requestId: string, accessToken: string): Promise<any> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.APPROVE_MODIFY_REQUEST.replace('{requestId}', requestId));
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
      });
      
      
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to approve modify request! Status: ${response.status}`
        );
      }
      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async rejectModifyRequest(requestId: string, accessToken: string): Promise<any> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.REJECT_MODIFY_REQUEST.replace('{requestId}', requestId));
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
      });
      
      
      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to reject modify request! Status: ${response.status}`
        );
      }
      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }



  static async createRating(
    turnId: string,
    ratingData: { score: number; subcategories: string[] },
    accessToken: string
  ): Promise<any> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_RATING.replace('{turnId}', turnId));
    
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'POST',
        body: JSON.stringify(ratingData),
      });


      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        logger.error('[TurnService] createRating - Error:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to create rating! Status: ${response.status}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error('[TurnService] createRating - Exception:', error);
      throw error;
    }
  }

  static async getRatingSubcategories(role?: string, accessToken?: string): Promise<string[]> {
    const url = role 
      ? `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_RATING_SUBCATEGORIES)}?role=${encodeURIComponent(role)}`
      : buildApiUrl(API_CONFIG.ENDPOINTS.GET_RATING_SUBCATEGORIES);
    
    try {
      // Public when called without a session (the endpoint allows it); the
      // authenticated variant goes through the 401 → refresh → retry interceptor.
      const response = accessToken
        ? await authenticatedFetch(url, accessToken, { method: 'GET' })
        : await fetch(url, { ...getDefaultFetchOptions(), method: 'GET' });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        logger.error('[TurnService] getRatingSubcategories - Error:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch rating subcategories! Status: ${response.status}`
        );
      }

      const result: string[] = await response.json();
      return result;
    } catch (error) {
      logger.error('[TurnService] getRatingSubcategories - Exception:', error);
      throw error;
    }
  }

  static async getRatedSubcategoryCounts(ratedId: string, accessToken?: string, raterRole?: string): Promise<{ subcategory: string | null; count: number }[]> {
    let url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_RATED_SUBCATEGORY_COUNTS.replace('{ratedId}', ratedId));
    if (raterRole) {
      url = `${url}?raterRole=${encodeURIComponent(raterRole)}`;
    }

    try {
      const response = accessToken
        ? await authenticatedFetch(url, accessToken, { method: 'GET' })
        : await fetch(url, { ...getDefaultFetchOptions(), method: 'GET' });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        logger.error('[TurnService] getRatedSubcategoryCounts - Error:', errorData);
        throw new Error(errorData?.message || errorData?.error || `Failed to fetch subcategory counts! Status: ${response.status}`);
      }

      const result: { subcategory: string | null; count: number }[] = await response.json();
      return result;
    } catch (error) {
      logger.error('[TurnService] getRatedSubcategoryCounts - Exception:', error);
      throw error;
    }
  }
}