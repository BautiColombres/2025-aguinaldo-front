
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
    RESERVE_TURN: '/api/turns/reserve',
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

export const getDefaultFetchOptions = (): RequestInit => ({
  headers: API_CONFIG.DEFAULT_HEADERS,
  signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
});

export const getAuthenticatedFetchOptions = (accessToken: string): RequestInit => ({
  headers: {
    ...API_CONFIG.DEFAULT_HEADERS,
    'Authorization': `Bearer ${accessToken}`,
  },
  signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
});

export const getAuthenticatedFetchOptionsWithRefreshToken = (accessToken: string, refreshToken: string): RequestInit => ({
  headers: {
    ...API_CONFIG.DEFAULT_HEADERS,
    'Authorization': `Bearer ${accessToken}`,
    'Refresh-Token': refreshToken,
  },
  signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
});