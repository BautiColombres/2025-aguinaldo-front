import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { checkStoredAuth, submitAuthentication, logoutUser } from './authMachineUtils'
import { AuthService } from '../../service/auth-service.service'

// Mock the AuthService
vi.mock('../../service/auth-service.service', () => ({
  AuthService: {
    getStoredAuthData: vi.fn(),
    signIn: vi.fn(),
    registerPatient: vi.fn(),
    registerDoctor: vi.fn(),
    signOut: vi.fn(),
    clearAuthData: vi.fn(),
    refreshToken: vi.fn()
  }
}))

describe('authMachineUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset global fetch mock
    global.fetch = vi.fn()
  })

  describe('checkStoredAuth', () => {
    it('should return authenticated with the fresh auth data when refresh succeeds', async () => {
      const refreshed = {
        id: '1',
        role: 'PATIENT',
        status: 'ACTIVE',
        accessToken: 'fresh-access-token'
      }
      ;(AuthService.refreshToken as Mock).mockResolvedValue(refreshed)

      const result = await checkStoredAuth()

      expect(AuthService.refreshToken).toHaveBeenCalledWith()
      expect(result.authData).toEqual(refreshed)
      expect(result.isAuthenticated).toBe(true)
    })

    it('should not read stored auth data from localStorage', async () => {
      ;(AuthService.refreshToken as Mock).mockResolvedValue({ accessToken: 'fresh' })

      await checkStoredAuth()

      expect(AuthService.getStoredAuthData).not.toHaveBeenCalled()
    })

    it('should return not authenticated when refresh returns no access token', async () => {
      ;(AuthService.refreshToken as Mock).mockResolvedValue({})

      const result = await checkStoredAuth()

      expect(result.isAuthenticated).toBe(false)
    })

    it('should return not authenticated when refresh throws (401 / missing cookie)', async () => {
      ;(AuthService.refreshToken as Mock).mockRejectedValue(new Error('Token refresh failed'))

      const result = await checkStoredAuth()

      expect(result.authData).toBeNull()
      expect(result.isAuthenticated).toBe(false)
    })
  })

  describe('submitAuthentication', () => {
    it('should call signIn for login mode', async () => {
      const context = {
        mode: 'login' as const,
        isPatient: true,
        hasErrorsOrEmpty: false,
        isAuthenticated: false,
        loading: false,
        loggingOut: false,
        formValues: {
          email: 'test@example.com',
          password: 'password123',
          name: '',
          surname: '',
          dni: '',
          gender: '',
          birthdate: null,
          password_confirm: '',
          phone: '',
          specialty: null,
          medicalLicense: null,
          slotDurationMin: null
        },
        send: vi.fn()
      }
      const mockResponse = { success: true }
      ;(AuthService.signIn as Mock).mockResolvedValue(mockResponse)

      const result = await submitAuthentication({ context })

      expect(AuthService.signIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
      expect(result).toEqual(mockResponse)
    })

    it('should call registerPatient for register mode with isPatient true', async () => {
      const context = {
        mode: 'register' as const,
        isPatient: true,
        hasErrorsOrEmpty: false,
        isAuthenticated: false,
        loading: false,
        loggingOut: false,
        formValues: {
          name: 'John',
          surname: 'Doe',
          email: 'test@example.com',
          password: 'password123',
          password_confirm: 'password123',
          dni: '12345678',
          gender: 'MALE',
          birthdate: '1990-01-01',
          phone: '123456789',
          specialty: 'CARDIOLOGY',
          medicalLicense: 'LIC123',
          slotDurationMin: 30
        },
        send: vi.fn()
      }
      const mockResponse = { success: true }
      ;(AuthService.registerPatient as Mock).mockResolvedValue(mockResponse)

      const result = await submitAuthentication({ context })

      expect(AuthService.registerPatient).toHaveBeenCalledWith({
        name: 'John',
        surname: 'Doe',
        email: 'test@example.com',
        password: 'password123',
        password_confirm: 'password123',
        dni: '12345678',
        gender: 'MALE',
        birthdate: '1990-01-01',
        phone: '123456789',
        specialty: 'CARDIOLOGY',
        medicalLicense: 'LIC123',
        slotDurationMin: 30
      })
      expect(result).toEqual(mockResponse)
    })

    it('should call registerDoctor for register mode with isPatient false', async () => {
      const context = {
        mode: 'register' as const,
        isPatient: false,
        hasErrorsOrEmpty: false,
        isAuthenticated: false,
        loading: false,
        loggingOut: false,
        formValues: {
          name: 'Dr. John',
          surname: 'Doe',
          email: 'doctor@example.com',
          password: 'password123',
          password_confirm: 'password123',
          dni: '12345678',
          gender: 'MALE',
          birthdate: '1980-01-01',
          phone: '123456789',
          specialty: 'CARDIOLOGY',
          medicalLicense: 'LIC123',
          slotDurationMin: 30
        },
        send: vi.fn()
      }
      const mockResponse = { success: true }
      ;(AuthService.registerDoctor as Mock).mockResolvedValue(mockResponse)

      const result = await submitAuthentication({ context })

      expect(AuthService.registerDoctor).toHaveBeenCalledWith({
        name: 'Dr. John',
        surname: 'Doe',
        email: 'doctor@example.com',
        password: 'password123',
        password_confirm: 'password123',
        dni: '12345678',
        gender: 'MALE',
        birthdate: '1980-01-01',
        phone: '123456789',
        specialty: 'CARDIOLOGY',
        medicalLicense: 'LIC123',
        slotDurationMin: 30
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('logoutUser', () => {
    it('should call signOut() with no argument and clear local data', async () => {
      ;(AuthService.signOut as Mock).mockResolvedValue(undefined)

      const result = await logoutUser()

      expect(AuthService.signOut).toHaveBeenCalledWith()
      expect(AuthService.clearAuthData).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should still clear local data when signOut fails', async () => {
      ;(AuthService.signOut as Mock).mockRejectedValue(new Error('API error'))

      const result = await logoutUser()

      expect(AuthService.signOut).toHaveBeenCalledWith()
      expect(AuthService.clearAuthData).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should not read the refresh token from localStorage', async () => {
      ;(AuthService.signOut as Mock).mockResolvedValue(undefined)

      await logoutUser()

      expect(AuthService.getStoredAuthData).not.toHaveBeenCalled()
    })
  })
})