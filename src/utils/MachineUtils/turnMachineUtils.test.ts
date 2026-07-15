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

// FBUG-003 — the real config/api is used so the centralized `authenticatedFetch`
// interceptor (401 → refresh → retry) is exercised; only the orchestrator broadcast
// is stubbed.
const { orchestratorSend } = vi.hoisted(() => ({ orchestratorSend: vi.fn() }))

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: orchestratorSend,
    sendToMachine: vi.fn()
  }
}))

const REFRESH_URL = 'http://localhost:8080/api/auth/refresh-token'

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

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/turn456/cancel',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'Content-Type': 'application/json'
          })
        })
      )
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
    it('should call the authenticated endpoint through the interceptor and return turn details', async () => {
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

      const result = await loadTurnDetails(params)

      expect(result).toEqual({ id: 'turn456', status: 'PENDING' })
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/my-turns',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({ Authorization: 'Bearer token123' })
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

    // FBUG-003 — the util must not hand-roll any retry: the centralized interceptor
    // owns the single refresh attempt, and a failed refresh ends the session.
    it('delegates the 401 to the centralized interceptor (one refresh, no manual retry)', async () => {
      const params = {
        turnId: 'turn456',
        accessToken: 'token123'
      }
      ;(global.fetch as Mock).mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Unauthorized'),
        json: vi.fn().mockResolvedValue({ message: 'Unauthorized' })
      })

      const { AuthService } = await import('../../service/auth-service.service')

      await expect(loadTurnDetails(params)).rejects.toThrow()

      expect(AuthService.refreshToken).not.toHaveBeenCalled()
      const calls = (global.fetch as Mock).mock.calls
      expect(calls.filter(([url]) => url === REFRESH_URL)).toHaveLength(1)
      // no retry of the original request when the refresh fails
      expect(calls.filter(([url]) => url === 'http://localhost:8080/api/turns/my-turns')).toHaveLength(1)
      // best-effort signout to revoke the (rotated) refresh cookie on terminal expiry
      const SIGNOUT_URL = 'http://localhost:8080/api/auth/signout'
      expect(calls.filter(([url]) => url === SIGNOUT_URL)).toHaveLength(1)
      expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' })
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

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/turn456/complete',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'Content-Type': 'application/json'
          })
        })
      )
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

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/turns/turn456/no-show',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'Content-Type': 'application/json'
          })
        })
      )
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

  // FBUG-003 — these three mutations (patient cancels; doctor completes / marks
  // no-show) used to call raw `fetch` with a hand-rolled Authorization header, so an
  // expired access token dropped the action silently: no refresh, no retry, no
  // re-login. They now go through the centralized interceptor like everything else.
  describe('expired access token (FBUG-003)', () => {
    const FRESH = 'fresh-token'

    const respondWithExpiry = (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) {
        return {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ id: 'u1', role: 'DOCTOR', status: 'ACTIVE', accessToken: FRESH })
        }
      }
      const auth = (init.headers as Record<string, string>).Authorization
      return auth === `Bearer ${FRESH}`
        ? { ok: true, status: 200, json: vi.fn().mockResolvedValue({}), text: vi.fn().mockResolvedValue('') }
        : {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: vi.fn().mockResolvedValue({ message: 'Unauthorized' }),
            text: vi.fn().mockResolvedValue('Unauthorized')
          }
    }

    const cases: Array<[string, (p: { accessToken: string; turnId: string }) => Promise<unknown>, string]> = [
      ['cancelTurn', cancelTurn, 'http://localhost:8080/api/turns/turn456/cancel'],
      ['completeTurn', completeTurn, 'http://localhost:8080/api/turns/turn456/complete'],
      ['noShowTurn', noShowTurn, 'http://localhost:8080/api/turns/turn456/no-show']
    ]

    it.each(cases)('%s refreshes the token and retries once, then succeeds', async (_name, action, url) => {
      ;(global.fetch as Mock).mockImplementation(respondWithExpiry)

      await expect(action({ accessToken: 'expired-token', turnId: 'turn456' })).resolves.not.toThrow()

      const calls = (global.fetch as Mock).mock.calls
      expect(calls.filter(([u]) => u === REFRESH_URL)).toHaveLength(1)

      const actionCalls = calls.filter(([u]) => u === url)
      expect(actionCalls).toHaveLength(2)
      expect((actionCalls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer expired-token')
      expect((actionCalls[1][1].headers as Record<string, string>).Authorization).toBe(`Bearer ${FRESH}`)
      expect(orchestratorSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TOKEN_REFRESHED', accessToken: FRESH })
      )
    })

    it.each(cases)('%s ends the session when the refresh fails', async (_name, action) => {
      ;(global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ message: 'Unauthorized' }),
        text: vi.fn().mockResolvedValue('Unauthorized')
      })

      await expect(action({ accessToken: 'expired-token', turnId: 'turn456' })).rejects.toThrow()

      expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' })
    })
  })
})
