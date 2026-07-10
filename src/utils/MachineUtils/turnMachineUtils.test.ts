import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import {
  createTurn,
  cancelTurn,
  createModifyTurnRequest,
  loadTurnDetails,
  loadDoctorAvailability,
  loadAvailableSlots,
  completeTurn,
  noShowTurn
} from './turnMachineUtils'
import { TurnService } from '../../service/turn-service.service'

// Mock fetch globally
global.fetch = vi.fn()

// Mock the TurnService
vi.mock('../../service/turn-service.service', () => ({
  TurnService: {
    createTurn: vi.fn(),
    createModifyRequest: vi.fn(),
    getDoctorAvailability: vi.fn(),
    getAvailableTurns: vi.fn(),
    getMyTurns: vi.fn(),
    getDoctorModifyRequests: vi.fn()
  }
}))

// Mock AuthService for token refresh
vi.mock('../../service/auth-service.service', () => ({
  AuthService: {
    refreshToken: vi.fn()
  }
}))

// Spy on the centralized api helpers while keeping buildApiUrl/API_CONFIG real.
vi.mock('../../../config/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/api')>()
  return {
    ...actual,
    getAuthenticatedFetchOptions: vi.fn((accessToken: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    }))
  }
})

describe('turnMachineUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as Mock).mockClear()
  })

  describe('createTurn', () => {
    it('should call TurnService.createTurn with correct parameters', async () => {
      const params = {
        accessToken: 'token123',
        userId: 'user456',
        doctorId: 'doctor789',
        scheduledAt: '2024-01-01T10:00:00Z'
      }
      const mockResponse = { id: 'turn123', status: 'CONFIRMED' }
      ;(TurnService.createTurn as Mock).mockResolvedValue(mockResponse)

      const result = await createTurn(params)

      expect(TurnService.createTurn).toHaveBeenCalledWith(
        {
          doctorId: 'doctor789',
          patientId: 'user456',
          scheduledAt: '2024-01-01T10:00:00Z'
        },
        'token123'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('cancelTurn', () => {
    it('should successfully cancel turn', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      })

      await expect(cancelTurn(params)).resolves.not.toThrow()

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/api/turns/turn456/cancel', {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should throw error when cancel fails', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('Cancel failed')
      })

      await expect(cancelTurn(params)).rejects.toThrow('Failed to cancel turn: Cancel failed')
    })
  })

  describe('createModifyTurnRequest', () => {
    it('should call TurnService.createModifyRequest with correct parameters', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456',
        newScheduledAt: '2024-01-02T11:00:00Z'
      }
      const mockResponse = { id: 'request123', status: 'PENDING' }
      ;(TurnService.createModifyRequest as Mock).mockResolvedValue(mockResponse)

      const result = await createModifyTurnRequest(params)

      expect(TurnService.createModifyRequest).toHaveBeenCalledWith({
        turnId: 'turn456',
        newScheduledAt: '2024-01-02T11:00:00Z'
      }, 'token123')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('loadTurnDetails', () => {
    // Routes HTTP through the centralized config/api helpers (buildApiUrl +
    // getAuthenticatedFetchOptions), not a hand-rolled fetch config.
    it('should use buildApiUrl and getAuthenticatedFetchOptions and return turn details', async () => {
      const params = {
        turnId: 'turn456',
        accessToken: 'token123'
      }
      const mockTurns = [
        { id: 'turn123', status: 'CONFIRMED' },
        { id: 'turn456', status: 'PENDING' }
      ]
      ;(global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTurns)
      })

      const { getAuthenticatedFetchOptions } = await import('../../../config/api')

      const result = await loadTurnDetails(params)

      expect(result).toEqual({ id: 'turn456', status: 'PENDING' })
      // Uses the centralized authenticated fetch options helper.
      expect(getAuthenticatedFetchOptions).toHaveBeenCalledWith('token123')
      // buildApiUrl produced the full my-turns URL and credentials are included.
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/my-turns',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include'
        })
      )
    })

    it('should throw error when turn not found', async () => {
      const params = {
        turnId: 'turn999',
        accessToken: 'token123'
      }
      const mockTurns = [
        { id: 'turn123', status: 'CONFIRMED' },
        { id: 'turn456', status: 'PENDING' }
      ]
      ;(global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTurns)
      })

      await expect(loadTurnDetails(params)).rejects.toThrow('Turn with ID turn999 not found in your turns')
    })

    // Post-FSEC-H1 the refresh flow is centralized; loadTurnDetails must NOT
    // hand-roll a manual refresh-token retry on 401.
    it('should NOT hand-roll a manual refresh-token retry on 401', async () => {
      const params = {
        turnId: 'turn456',
        accessToken: 'token123'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Unauthorized')
      })

      const { AuthService } = await import('../../service/auth-service.service')

      await expect(loadTurnDetails(params)).rejects.toThrow()

      expect(AuthService.refreshToken).not.toHaveBeenCalled()
      // A single request — no manual retry loop.
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw error on API failure', async () => {
      const params = {
        turnId: 'turn456',
        accessToken: 'token123'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server error')
      })

      await expect(loadTurnDetails(params)).rejects.toThrow('Failed to load my turns: Internal Server Error - Server error')
    })
  })

  describe('loadDoctorAvailability', () => {
    it('should return available dates from TurnService', async () => {
      const params = {
        accessToken: 'token123',
        doctorId: 'doctor456'
      }
      const mockAvailability = {
        availableDates: ['2024-01-01', '2024-01-02']
      }
      ;(TurnService.getDoctorAvailability as Mock).mockResolvedValue(mockAvailability)

      const result = await loadDoctorAvailability(params)

      expect(TurnService.getDoctorAvailability).toHaveBeenCalledWith('doctor456', 'token123')
      expect(result).toEqual(['2024-01-01', '2024-01-02'])
    })

    it('should return empty array when no availability', async () => {
      const params = {
        accessToken: 'token123',
        doctorId: 'doctor456'
      }
      ;(TurnService.getDoctorAvailability as Mock).mockResolvedValue(null)

      const result = await loadDoctorAvailability(params)

      expect(result).toEqual([])
    })
  })

  describe('loadAvailableSlots', () => {
    it('should return available slots from TurnService', async () => {
      const params = {
        accessToken: 'token123',
        doctorId: 'doctor456',
        date: '2024-01-01'
      }
      const mockSlots = ['10:00', '11:00', '14:00']
      ;(TurnService.getAvailableTurns as Mock).mockResolvedValue(mockSlots)

      const result = await loadAvailableSlots(params)

      expect(TurnService.getAvailableTurns).toHaveBeenCalledWith('doctor456', '2024-01-01', 'token123')
      expect(result).toEqual(['10:00', '11:00', '14:00'])
    })

    it('should return empty array when no slots available', async () => {
      const params = {
        accessToken: 'token123',
        doctorId: 'doctor456',
        date: '2024-01-01'
      }
      ;(TurnService.getAvailableTurns as Mock).mockResolvedValue(null)

      const result = await loadAvailableSlots(params)

      expect(result).toEqual([])
    })
  })

  describe('completeTurn', () => {
    it('should successfully complete turn', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      })

      await expect(completeTurn(params)).resolves.not.toThrow()

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/api/turns/turn456/complete', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should throw error when complete fails', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('Complete failed')
      })

      await expect(completeTurn(params)).rejects.toThrow('Failed to complete turn: Complete failed')
    })
  })

  describe('noShowTurn', () => {
    it('should successfully mark turn as no-show', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      })

      await expect(noShowTurn(params)).resolves.not.toThrow()

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/api/turns/turn456/no-show', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should throw error when no-show fails', async () => {
      const params = {
        accessToken: 'token123',
        turnId: 'turn456'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('No-show failed')
      })

      await expect(noShowTurn(params)).rejects.toThrow('Failed to mark turn as no-show: No-show failed')
    })
  })
})