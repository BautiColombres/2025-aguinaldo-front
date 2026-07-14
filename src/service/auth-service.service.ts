import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions, getDefaultFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type {
    RegisterRequestData,
    RegisterResponse,
    SignInRequestData,
    SignInResponse,
    ApiErrorResponse,
    ProfileResponse
} from '../models/Auth';

export class AuthService {

  static async registerPatient(data: RegisterRequestData): Promise<RegisterResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.REGISTER_PATIENT);
    
    try {
      const response = await fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        
        // Handle validation errors with field-specific messages
        if (response.status === 400 && (errorData as any)?.fieldErrors) {
          const validationError = new Error('Validation failed');
          (validationError as any).fieldErrors = (errorData as any).fieldErrors;
          throw validationError;
        }
        
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Patient registration failed! Status: ${response.status}`
        );
      }

      const result: RegisterResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('Patient registration failed:', error);
      throw error;
    }
  }
  
  static async verifyAccount(token: string): Promise<{ message: string }> {
    const url = `${buildApiUrl('/api/auth/verify')}?token=${token}`;
    
    try {
      const response = await fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Error verificando la cuenta');
      }

      return await response.json();
    } catch (error) {
      logger.error('Account verification failed:', error);
      throw error;
    }
  }

  static async registerDoctor(data: RegisterRequestData): Promise<RegisterResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.REGISTER_DOCTOR);
    
    try {
      const response = await fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        
        // Handle validation errors with field-specific messages
        if (response.status === 400 && (errorData as any)?.fieldErrors) {
          const validationError = new Error('Validation failed');
          (validationError as any).fieldErrors = (errorData as any).fieldErrors;
          throw validationError;
        }
        
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Doctor registration failed! Status: ${response.status}`
        );
      }

      const result: RegisterResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('Doctor registration failed:', error);
      throw error;
    }
  }

  static async signIn(data: SignInRequestData): Promise<SignInResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.SIGNIN);
    
    try {
      const response = await fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          'Invalid credentials'
        );
      }

      const result: SignInResponse = await  response.json();
      
      return result;
    } catch (error) {
      logger.error('Sign in failed:', error);
      throw error;
    }
  }

  static async signOut(): Promise<void> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.SIGNOUT);

    try {
      const response = await  fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
          errorData?.error ||
          `Sign out failed! Status: ${response.status}`
        );
      }

    } catch (error) {
      logger.error('Sign out failed:', error);
      throw error;
    }
  }

  static async refreshToken(): Promise<SignInResponse> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.REFRESH_TOKEN);

    try {
      const response = await fetch(url, {
        ...getDefaultFetchOptions(),
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
          errorData?.error ||
          'Token refresh failed'
        );
      }

      const result: SignInResponse = await response.json();

      return result;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  static saveAuthData(_signInResponse: SignInResponse) {
    // intentionally does nothing (no localStorage/sessionStorage token storage)
  }

  static getStoredAuthData(): SignInResponse | null {
    return null;
  }

  static clearAuthData() {
    localStorage.removeItem('authData');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }


  static async getProfile(accessToken: string, profileId: string): Promise<ProfileResponse> {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_PROFILE.replace('{profileId}', profileId));
      
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
            `Failed to fetch data profile! Status: ${response.status}`
          );
        }
  
        const result: ProfileResponse = await response.json();
        return result;
      } catch (error) {
        logger.error('Failed to fetch data profile:', error);
        throw error;
      }
    }

    static async updateProfile(accessToken: string,profileId: string,updates: Partial<ProfileResponse>): Promise<ProfileResponse> {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.UPDATE_PROFILE.replace('{profileId}', profileId));

      try {
        const response = await fetch(url, {
          ...getAuthenticatedFetchOptions(accessToken),
          method: 'PUT',
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
          throw new Error(
            errorData?.message ||
            errorData?.error ||
            `Failed to update profile! Status: ${response.status}`
          );
        }

        const result: ProfileResponse = await response.json();
        return result;
      } catch (error) {
        logger.error("Failed to update profile:", error);
        throw error;
      }
    }

    static async deactivateAccount(accessToken: string): Promise<void> {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.DEACTIVATE_ACCOUNT);

      try {
        const response = await fetch(url, {
          ...getAuthenticatedFetchOptions(accessToken),
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
          logger.error('Error en desactivación:', errorData);
          throw new Error(
            errorData?.message ||
            errorData?.error ||
            `Failed to deactivate account! Status: ${response.status}`
          );
        }

        // Clear auth data immediately after successful deactivation
        this.clearAuthData();
      } catch (error) {
        logger.error("Failed to deactivate account:", error);
        throw error;
      }
    }

}