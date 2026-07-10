import { TurnService } from "../../service/turn-service.service";
import { API_CONFIG, buildApiUrl } from "../../../config/api";
import type { TurnResponse } from "../../models/Turn";

/**
 * Utility functions for turnMachine service calls
 */

export interface ReserveTurnParams {
  accessToken: string;
  userId: string;
  turnId: string;
}

export interface CreateTurnParams {
  accessToken: string;
  userId: string;
  doctorId: string;
  scheduledAt: string;
  motive?: string;
}

export interface CancelTurnParams {
  accessToken: string;
  turnId: string;
}

export interface CompleteTurnParams {
  accessToken: string;
  turnId: string;
}

export interface NoShowTurnParams {
  accessToken: string;
  turnId: string;
}

export interface ModifyTurnParams {
  accessToken: string;
  turnId: string;
  newScheduledAt: string;
}

export interface LoadTurnDetailsParams {
  turnId: string;
  accessToken: string;
}

export interface LoadDoctorAvailabilityParams {
  accessToken: string;
  doctorId: string;
}

export interface LoadAvailableSlotsParams {
  accessToken: string;
  doctorId: string;
  date: string;
}

/**
 * Create a new turn
 */
export const createTurn = async ({ accessToken, userId, doctorId, scheduledAt, motive }: CreateTurnParams): Promise<TurnResponse> => {
  const payload: any = {
    doctorId,
    patientId: userId,
    scheduledAt,
  };

  if (motive && motive.toString().trim() !== '') {
    // backend expects field named `motive`
    payload.motive = motive;
  }

  return await TurnService.createTurn(payload, accessToken);
};

/**
 * Cancel a turn
 */
export const cancelTurn = async ({ accessToken, turnId }: CancelTurnParams): Promise<void> => {
  const url = buildApiUrl(API_CONFIG.ENDPOINTS.CANCEL_TURN.replace('{turnId}', turnId));
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to cancel turn: ${errorData}`);
  }
};

/**
 * Complete a turn
 */
export const completeTurn = async ({ accessToken, turnId }: CompleteTurnParams): Promise<void> => {
  const url = buildApiUrl(`/api/turns/${turnId}/complete`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to complete turn: ${errorData}`);
  }
};

/**
 * Mark a turn as no-show
 */
export const noShowTurn = async ({ accessToken, turnId }: NoShowTurnParams): Promise<void> => {
  const url = buildApiUrl(`/api/turns/${turnId}/no-show`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to mark turn as no-show: ${errorData}`);
  }
};

/**
 * Create a modify turn request
 */
export const createModifyTurnRequest = async ({ accessToken, turnId, newScheduledAt }: ModifyTurnParams): Promise<any> => {
  return await  TurnService.createModifyRequest({
    turnId,
    newScheduledAt
  }, accessToken);
};

/**
 * Load turn details from my-turns API
 */
export const loadTurnDetails = async ({ turnId, accessToken }: { turnId: string; accessToken: string }): Promise<TurnResponse | null> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_MY_TURNS);
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // FSEC-H1 Stage 2 — cookie-based refresh. Mint a fresh access token via the
      // httpOnly refresh cookie (no token read from / written to localStorage),
      // then retry with the new Bearer token.
      try {
        const { AuthService } = await import('../../service/auth-service.service');
        const refreshed = await AuthService.refreshToken();
        if (refreshed.accessToken) {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${refreshed.accessToken}`,
              'Content-Type': 'application/json'
            }
          });
        }
      } catch (refreshError) {
        console.error('Error al refrescar el token en loadTurnDetails:', refreshError);
        throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.');
      }
    }
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to load my turns: ${response.statusText} - ${errorData}`);
    }
    const myTurns: TurnResponse[] = await response.json();
    const turn = myTurns.find((turn: TurnResponse) => turn.id === turnId);
    if (!turn) {
      throw new Error(`Turn with ID ${turnId} not found in your turns`);
    }
    return turn;
  } catch (error) {
    console.error('Error loading turn details:', error);
    throw error;
  }
};

/**
 * Load doctor availability dates
 */
export const loadDoctorAvailability = async ({ accessToken, doctorId }: LoadDoctorAvailabilityParams): Promise<string[]> => {
  const availability = await TurnService.getDoctorAvailability(doctorId, accessToken);
  return availability?.availableDates || [];
};

/**
 * Load available time slots for a specific date and doctor
 */
export const loadAvailableSlots = async ({ accessToken, doctorId, date }: LoadAvailableSlotsParams): Promise<string[]> => {
  const slots = await TurnService.getAvailableTurns(doctorId, date, accessToken);
  return slots || [];
};