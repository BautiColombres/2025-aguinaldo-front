import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth-service.service';
import type {
  RegisterRequestData,
  RegisterResponse,
  SignInRequestData,
  SignInResponse,
  ProfileResponse
} from '../models/Auth';

// Mock the API config
vi.mock('../../config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:8080',
    ENDPOINTS: {
      REGISTER_PATIENT: '/api/auth/register/patient',
      REGISTER_DOCTOR: '/api/auth/register/doctor',
      SIGNIN: '/api/auth/signin',
      SIGNOUT: '/api/auth/signout',
      REFRESH_TOKEN: '/api/auth/refresh-token',
      GET_PROFILE: '/api/profile/{profileId}',
      UPDATE_PROFILE: '/api/profile/{profileId}',
      DEACTIVATE_ACCOUNT: '/api/profile/me/deactivate'
    },
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json'
    }
  },
  buildApiUrl: vi.fn((endpoint: string) => `http://localhost:8080${endpoint}`),
  getDefaultFetchOptions: vi.fn(() => ({
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })),
  getAuthenticatedFetchOptions: vi.fn((token: string) => ({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  }))
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('registerPatient', () => {
    const mockRegisterData: RegisterRequestData = {
      name: 'John',
      surname: 'Doe',
      dni: '12345678',
      gender: 'M',
      birthdate: '1990-01-01',
      email: 'john.doe@example.com',
      password: 'password123',
      password_confirm: 'password123',
      phone: '123456789',
      specialty: null,
      medicalLicense: null
    };

    const mockRegisterResponse: RegisterResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'PATIENT',
      status: 'PENDING',
      message: 'Patient registered successfully'
    };

    it('should successfully register a patient', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRegisterResponse)
      });

      const result = await AuthService.registerPatient(mockRegisterData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/register/patient',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockRegisterData)
        })
      );
      expect(result).toEqual(mockRegisterResponse);
    });

    it('should throw error when registration fails with error details', async () => {
      const errorResponse = { message: 'Email already exists' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.registerPatient(mockRegisterData))
        .rejects.toThrow('Email already exists');
    });

    it('should throw error with default message when response has no error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.registerPatient(mockRegisterData))
        .rejects.toThrow('Patient registration failed! Status: 500');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.registerPatient(mockRegisterData))
        .rejects.toThrow('Network error');
    });

    it('should throw error when response.json() fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(AuthService.registerPatient(mockRegisterData))
        .rejects.toThrow('Patient registration failed! Status: 400');
    });
  });

  describe('registerDoctor', () => {
    const mockRegisterData: RegisterRequestData = {
      name: 'Dr. Jane',
      surname: 'Smith',
      dni: '87654321',
      gender: 'F',
      birthdate: '1985-05-15',
      email: 'jane.smith@example.com',
      password: 'password123',
      password_confirm: 'password123',
      phone: '987654321',
      specialty: 'Cardiology',
      medicalLicense: 'LIC123456'
    };

    const mockRegisterResponse: RegisterResponse = {
      id: '2',
      email: 'jane.smith@example.com',
      name: 'Dr. Jane',
      surname: 'Smith',
      role: 'DOCTOR',
      status: 'PENDING',
      message: 'Doctor registered successfully'
    };

    it('should successfully register a doctor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRegisterResponse)
      });

      const result = await AuthService.registerDoctor(mockRegisterData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/register/doctor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockRegisterData)
        })
      );
      expect(result).toEqual(mockRegisterResponse);
    });

    it('should throw error when registration fails', async () => {
      const errorResponse = { error: 'Invalid medical license' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.registerDoctor(mockRegisterData))
        .rejects.toThrow('Invalid medical license');
    });

    it('should throw error when fetch fails during doctor registration', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(AuthService.registerDoctor(mockRegisterData))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('signIn', () => {
    const mockSignInData: SignInRequestData = {
      email: 'john.doe@example.com',
      password: 'password123'
    };

    const mockSignInResponse: SignInResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'PATIENT',
      status: 'ACTIVE',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456'
    };

    it('should successfully sign in user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSignInResponse)
      });

      const result = await AuthService.signIn(mockSignInData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/signin',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockSignInData)
        })
      );
      expect(result).toEqual(mockSignInResponse);
    });

    it('should throw error when sign in fails with error details', async () => {
      const errorResponse = { message: 'Invalid credentials' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.signIn(mockSignInData))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw default error message when sign in fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.signIn(mockSignInData))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error when fetch fails during sign in', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.signIn(mockSignInData))
        .rejects.toThrow('Network error');
    });
  });

  describe('signOut', () => {
    // FSEC-H1 Stage 2 — signOut takes no argument; the refresh token travels as
    // an httpOnly cookie via credentials: 'include'. No Refresh-Token header.
    it('should successfully sign out user with credentials and no Refresh-Token header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(AuthService.signOut()).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/signout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );

      const [, options] = mockFetch.mock.calls[0];
      expect((options.headers ?? {})['Refresh-Token']).toBeUndefined();
    });

    it('should throw error when sign out fails', async () => {
      const errorResponse = { message: 'Invalid token' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.signOut())
        .rejects.toThrow('Invalid token');
    });

    it('should throw error with default message when sign out fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.signOut())
        .rejects.toThrow('Sign out failed! Status: 500');
    });

    it('should throw error when fetch fails during sign out', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(AuthService.signOut())
        .rejects.toThrow('Connection failed');
    });
  });

  describe('refreshToken', () => {
    // FSEC-H1 Stage 2 — refreshToken takes no argument; the refresh token travels
    // as an httpOnly cookie via credentials: 'include'. No Refresh-Token header.
    const mockSignInResponse: SignInResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'PATIENT',
      status: 'ACTIVE',
      accessToken: 'new-access-token-123'
    };

    it('should successfully refresh token using the cookie (credentials, no header)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSignInResponse)
      });

      const result = await AuthService.refreshToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/refresh-token',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );

      const [, options] = mockFetch.mock.calls[0];
      expect((options.headers ?? {})['Refresh-Token']).toBeUndefined();
      expect(result).toEqual(mockSignInResponse);
    });

    it('should throw error when token refresh fails', async () => {
      const errorResponse = { message: 'Token expired' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.refreshToken())
        .rejects.toThrow('Token expired');
    });

    it('should throw default error message when token refresh fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.refreshToken())
        .rejects.toThrow('Token refresh failed');
    });

    it('should throw error when fetch fails during token refresh', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.refreshToken())
        .rejects.toThrow('Network error');
    });
  });

  describe('saveAuthData (FSEC-H1: no token persistence)', () => {
    const mockSignInResponse: SignInResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'PATIENT',
      status: 'ACTIVE',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456'
    };

    it('must NOT write any token to localStorage', () => {
      AuthService.saveAuthData(mockSignInResponse);

      // Floor test: no token payload persisted anywhere.
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getStoredAuthData (FSEC-H1: nothing persisted to read)', () => {
    it('should always return null (no localStorage read of tokens)', () => {
      const result = AuthService.getStoredAuthData();

      expect(result).toBeNull();
      expect(localStorageMock.getItem).not.toHaveBeenCalled();
    });
  });

  describe('clearAuthData', () => {
    it('should clear all auth data from localStorage', () => {
      AuthService.clearAuthData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authData');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('getProfile', () => {
    const accessToken = 'access-token-123';
    const profileId = '1';
    const mockProfileResponse: ProfileResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      dni: '12345678',
      phone: '123456789',
      birthdate: '1990-01-01',
      gender: 'M',
      role: 'PATIENT',
      status: 'ACTIVE'
    };

    it('should successfully fetch profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfileResponse)
      });

      const result = await AuthService.getProfile(accessToken, profileId);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/profile/1',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockProfileResponse);
    });

    it('should throw error when profile fetch fails', async () => {
      const errorResponse = { message: 'Profile not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.getProfile(accessToken, profileId))
        .rejects.toThrow('Profile not found');
    });

    it('should throw error with default message when profile fetch fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.getProfile(accessToken, profileId))
        .rejects.toThrow('Failed to fetch data profile! Status: 500');
    });

    it('should throw error when fetch fails during profile fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.getProfile(accessToken, profileId))
        .rejects.toThrow('Network error');
    });
  });

  describe('updateProfile', () => {
    const accessToken = 'access-token-123';
    const profileId = '1';
    const updates = { phone: '987654321' };
    const mockProfileResponse: ProfileResponse = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John',
      surname: 'Doe',
      dni: '12345678',
      phone: '987654321',
      birthdate: '1990-01-01',
      gender: 'M',
      role: 'PATIENT',
      status: 'ACTIVE'
    };

    it('should successfully update profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfileResponse)
      });

      const result = await AuthService.updateProfile(accessToken, profileId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/profile/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
      expect(result).toEqual(mockProfileResponse);
    });

    it('should throw error when profile update fails', async () => {
      const errorResponse = { message: 'Invalid data' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.updateProfile(accessToken, profileId, updates))
        .rejects.toThrow('Invalid data');
    });

    it('should throw error with default message when profile update fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.updateProfile(accessToken, profileId, updates))
        .rejects.toThrow('Failed to update profile! Status: 500');
    });

    it('should throw error when fetch fails during profile update', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.updateProfile(accessToken, profileId, updates))
        .rejects.toThrow('Network error');
    });
  });

  describe('deactivateAccount', () => {
    const accessToken = 'access-token-123';

    it('should successfully deactivate account and clear auth data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await expect(AuthService.deactivateAccount(accessToken)).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/profile/me/deactivate',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authData');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });

    it('should throw error when deactivation fails', async () => {
      const errorResponse = { message: 'Cannot deactivate account' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      await expect(AuthService.deactivateAccount(accessToken))
        .rejects.toThrow('Cannot deactivate account');
    });

    it('should throw error with default message when deactivation fails without error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(AuthService.deactivateAccount(accessToken))
        .rejects.toThrow('Failed to deactivate account! Status: 500');
    });

    it('should throw error when fetch fails during deactivation', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(AuthService.deactivateAccount(accessToken))
        .rejects.toThrow('Network error');
    });
  });
});