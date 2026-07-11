
// FSEC-H2 — Resolve the API base URL with transport hardening.
// Production (non-DEV) MUST provide an https:// VITE_API_BASE_URL; we fail loudly
// otherwise instead of silently falling back to plaintext http. Only DEV may use
// http://localhost / http://127.0.0.1 (and defaults to it when the var is unset).
const resolveBaseUrl = (): string => {
  const isDev = Boolean(import.meta.env.DEV);
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const baseUrl = typeof rawBaseUrl === 'string' ? rawBaseUrl.trim() : '';

  const isLocalHttp =
    baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1');
  const isHttps = baseUrl.startsWith('https://');

  if (isDev) {
    if (!baseUrl) {
      return 'http://localhost:8080';
    }
    if (isHttps || isLocalHttp) {
      return baseUrl;
    }
    throw new Error(
      `FSEC-H2: VITE_API_BASE_URL must be https:// or http://localhost in DEV. Received: "${baseUrl}".`,
    );
  }

  if (!isHttps) {
    throw new Error(
      'FSEC-H2: VITE_API_BASE_URL must be set to an https:// URL in production. ' +
        'Refusing to fall back to an insecure http:// base URL.',
    );
  }

  return baseUrl;
};

export const API_CONFIG = {
  BASE_URL: resolveBaseUrl(),

  ENDPOINTS: {
    REGISTER_PATIENT: '/api/auth/register/patient',
    REGISTER_DOCTOR: '/api/auth/register/doctor',
    SIGNIN: '/api/auth/signin',
    SIGNOUT: '/api/auth/signout',
    REFRESH_TOKEN: '/api/auth/refresh-token',

    CREATE_TURN: '/api/turns',
    GET_AVAILABLE_TURNS: '/api/turns/available',
    GET_MY_TURNS: '/api/turns/my-turns',
    GET_DOCTOR_TURNS: '/api/turns/doctor',
    GET_PATIENT_TURNS: '/api/turns/patient',
    CANCEL_TURN: '/api/turns/{turnId}/cancel',
    CREATE_RATING: '/api/ratings/turns/{turnId}/rate',
    GET_RATING_SUBCATEGORIES: '/api/ratings/rating-subcategories',
    GET_RATED_SUBCATEGORY_COUNTS: '/api/ratings/rated/{ratedId}/subcategories-counts',
    
    MODIFY_TURN_REQUEST: '/api/turns/modify-requests',
    GET_MY_MODIFY_REQUESTS: '/api/turns/modify-requests/my-requests',
    GET_DOCTOR_MODIFY_REQUESTS: '/api/turns/modify-requests/pending?doctorId={doctorId}',
    DOCTOR_MODIFY_REQUEST: '/api/turns/modify-requests',
    
    GET_DOCTORS: '/api/doctors',
    GET_SPECIALTIES: '/api/doctors/specialties',
    GET_DOCTOR_PATIENTS: '/api/doctors/{doctorId}/patients',
    GET_DOCTOR_METRICS: '/api/doctors/{doctorId}/metrics',
    SAVE_DOCTOR_AVAILABILITY: '/api/doctors/{doctorId}/availability',
    GET_DOCTOR_AVAILABLE_SLOTS: '/api/doctors/{doctorId}/available-slots',

    GET_USER_BADGES: '/api/badges/{userId}',
    GET_USER_BADGE_PROGRESS: '/api/badges/{userId}/progress',
    GET_MY_BADGES: '/api/badges/my-badges',
    GET_MY_BADGE_PROGRESS: '/api/badges/my-progress',
    EVALUATE_USER_BADGES: '/api/badges/{userId}/evaluate',
    EVALUATE_MY_BADGES: '/api/badges/evaluate',

    GET_PENDING_DOCTORS: '/api/admin/pending-doctors',
    APPROVE_DOCTOR: '/api/admin/approve-doctor/{doctorId}',
    REJECT_DOCTOR: '/api/admin/reject-doctor/{doctorId}',
    GET_ADMIN_STATS: '/api/admin/stats',
    GET_ADMIN_RATINGS: '/api/admin/ratings',

    APPROVE_MODIFY_REQUEST: '/api/turns/modify-requests/{requestId}/approve',
    REJECT_MODIFY_REQUEST: '/api/turns/modify-requests/{requestId}/reject',

    GET_NOTIFICATIONS: '/api/notifications',
    DELETE_NOTIFICATION: '/api/notifications/{notificationId}',
    GET_DOCTOR_AVAILABILITY: '/api/doctors/{doctorId}/availability',
    UPDATE_MEDICAL_HISTORY: '/api/doctors/{doctorId}/patients/medical-history',
    
  
    ADD_MEDICAL_HISTORY: '/api/doctors/{doctorId}/medical-history',
    UPDATE_MEDICAL_HISTORY_ENTRY: '/api/doctors/{doctorId}/medical-history/{historyId}',
    DELETE_MEDICAL_HISTORY: '/api/doctors/{doctorId}/medical-history/{historyId}',
    GET_DOCTOR_MEDICAL_HISTORY: '/api/doctors/{doctorId}/medical-history',
    GET_PATIENT_MEDICAL_HISTORY: '/api/medical-history/patient/{patientId}',
    GET_PATIENT_HISTORY_BY_DOCTOR: '/api/doctors/{doctorId}/patients/{patientId}/medical-history',
    GET_PATIENT_TAGS: '/api/doctors/{doctorId}/patients/{patientId}/tags',

    GET_PROFILE: '/api/profile/{profileId}',
    UPDATE_PROFILE: '/api/profile/{profileId}',
    DEACTIVATE_ACCOUNT: '/api/profile/me/deactivate',
  },

  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },

  TIMEOUT: 10000,
} as const;

export const buildApiUrl = (endpoint: string): string => {
  // Always use the full URL with base path
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// FSEC-H1 — credentials: 'include' so the httpOnly refresh cookie (scoped to
// /api/auth) travels on signin (to receive Set-Cookie), refresh-token, and
// signout. Non-auth endpoints authenticate via the Bearer header; the cookie's
// Path=/api/auth means it is simply not attached elsewhere.
export const getDefaultFetchOptions = (): RequestInit => ({
  headers: API_CONFIG.DEFAULT_HEADERS,
  credentials: 'include',
  signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
});

export const getAuthenticatedFetchOptions = (accessToken: string): RequestInit => ({
  headers: {
    ...API_CONFIG.DEFAULT_HEADERS,
    'Authorization': `Bearer ${accessToken}`,
  },
  credentials: 'include',
  signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
});

// FBUG-M6 — shared error classifier / mapper.
// `AbortSignal.timeout` rejections (and manual aborts, 401s and network failures)
// were previously handled ad-hoc — one machine only checked for 401, timeout/abort
// rejections leaked raw/undefined text into the UI. This gives every machine one
// place to classify a rejection and surface a localized message.
export type ApiErrorKind = 'timeout' | 'unauthorized' | 'network' | 'unknown';

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  message: string;
  status?: number;
}

export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  timeout:
    'La solicitud tardó demasiado tiempo. Por favor, verificá tu conexión e intentá nuevamente.',
  unauthorized: 'Tu sesión expiró. Por favor, iniciá sesión nuevamente.',
  network: 'No se pudo conectar con el servidor. Verificá tu conexión a internet.',
  unknown: 'Ocurrió un error inesperado. Por favor, intentá nuevamente.',
};

/**
 * Classify an unknown rejection into a uniform, localized error.
 *
 * @param error The rejected value (Error, DOMException, string, ...).
 * @param fallbackMessage Message used for the `unknown` kind when the error
 *        carries no usable message (e.g. a non-Error rejection). Defaults to a
 *        generic localized message.
 */
export const classifyApiError = (
  error: unknown,
  fallbackMessage: string = API_ERROR_MESSAGES.unknown,
): ClassifiedApiError => {
  // AbortSignal.timeout() rejects with a DOMException named 'TimeoutError';
  // a manual AbortController.abort() rejects with 'AbortError'.
  const name = (error as { name?: string } | null | undefined)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return { kind: 'timeout', message: API_ERROR_MESSAGES.timeout };
  }

  if (error instanceof Error) {
    const raw = error.message ?? '';
    const lower = raw.toLowerCase();

    if (raw.includes('401') || lower.includes('unauthorized')) {
      return { kind: 'unauthorized', message: API_ERROR_MESSAGES.unauthorized, status: 401 };
    }

    // fetch() throws a TypeError ('Failed to fetch') on network failure.
    if (
      error instanceof TypeError ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('network request failed')
    ) {
      return { kind: 'network', message: API_ERROR_MESSAGES.network };
    }

    return { kind: 'unknown', message: raw || fallbackMessage };
  }

  return { kind: 'unknown', message: fallbackMessage };
};