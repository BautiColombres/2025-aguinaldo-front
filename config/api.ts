import { orchestrator } from '#/core/Orchestrator';
import { logger } from '#/utils/logger';

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

    CREATE_FOLLOWUP: '/api/doctors/{doctorId}/medical-history/{historyId}/followup',
    GET_FOLLOWUPS: '/api/doctors/{doctorId}/followups',
    DISMISS_FOLLOWUP: '/api/doctors/{doctorId}/followups/{reminderId}/dismiss',
    GET_PATIENT_FOLLOWUPS: '/api/patients/{patientId}/followups',
    GET_DOCTOR_PATIENT_FOLLOWUPS: '/api/doctors/{doctorId}/patients/{patientId}/followups',
    GET_DUE_FOR_FOLLOWUP: '/api/doctors/{doctorId}/patients/due-for-followup',

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

// NOTE: the old `getAuthenticatedFetchOptions` export is gone. Authenticated
// requests MUST go through `authenticatedFetch` (below) so they all get the
// 401 → refresh → retry handling; hand-building the Bearer options is exactly how
// BUG-003 (silent action loss on token expiry) happened.

// FBUG-M6 — shared error classifier / mapper.
// `AbortSignal.timeout` rejections (and manual aborts, 401s and network failures)
// were previously handled ad-hoc — one machine only checked for 401, timeout/abort
// rejections leaked raw/undefined text into the UI. This gives every machine one
// place to classify a rejection and surface a localized message.
export type ApiErrorKind =
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'network'
  | 'unknown';

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  message: string;
  status?: number;
}

export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  timeout:
    'La solicitud tardó demasiado tiempo. Por favor, verificá tu conexión e intentá nuevamente.',
  unauthorized: 'Tu sesión expiró. Por favor, iniciá sesión nuevamente.',
  forbidden: 'No tenés permisos para realizar esta acción.',
  conflict: 'La operación entra en conflicto con el estado actual. Actualizá la página e intentá nuevamente.',
  network: 'No se pudo conectar con el servidor. Verificá tu conexión a internet.',
  unknown: 'Ocurrió un error inesperado. Por favor, intentá nuevamente.',
};

// FBUG-002 — an Error that carries the HTTP status of the failed response.
// Services that need their caller (machine) to react to a SPECIFIC status — e.g.
// the follow-up dup-guard's 409 — throw this instead of a bare `Error`, so the
// machine can branch on a stable, structural signal rather than string-matching
// the backend's wording (which may change / come back empty).
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // Keep `instanceof ApiError` working when the class is down-levelled.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Read the HTTP status off a status-tagged rejection (see `ApiError`), if any. */
export const getApiErrorStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
};

/** True when the rejection is a 409 Conflict (duplicate / state clash). */
export const isConflictError = (error: unknown): boolean => getApiErrorStatus(error) === 409;

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

    // STATUS FIRST. When the rejection is status-tagged (see `ApiError`) the HTTP
    // status decides — never the backend's wording, and never a substring of the
    // message (a turn id or timestamp containing "403" must not be read as a
    // permission denial). The string heuristics below are only a fallback for the
    // plain `Error`s that services still throw.
    const status = getApiErrorStatus(error);
    if (status === 409) {
      return { kind: 'conflict', message: API_ERROR_MESSAGES.conflict, status: 409 };
    }
    if (status === 403) {
      return { kind: 'forbidden', message: API_ERROR_MESSAGES.forbidden, status: 403 };
    }
    if (status === 401) {
      return { kind: 'unauthorized', message: API_ERROR_MESSAGES.unauthorized, status: 401 };
    }

    // 403 is an authorization denial, NOT a session expiry: it must never be
    // classified as `unauthorized` (and never triggers a token refresh — the
    // interceptor only refreshes on HTTP 401). The backend's AccessDeniedHandler
    // returns a JSON body ({"error":"FORBIDDEN","message":"Access denied"}), so a
    // 403 no longer reaches us as an empty body / "Status: 403" message.
    // `\b403\b` (not `includes('403')`) so ids/timestamps can't trip it.
    if (
      /\b403\b/.test(raw) ||
      lower.includes('forbidden') ||
      lower.includes('access denied') ||
      lower.includes('acceso denegado')
    ) {
      return { kind: 'forbidden', message: API_ERROR_MESSAGES.forbidden, status: 403 };
    }

    if (/\b401\b/.test(raw) || lower.includes('unauthorized')) {
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

// ---------------------------------------------------------------------------
// FBUG-003 — centralized 401 → refresh → retry interceptor.
//
// Before this, `config/api` only built URLs/options: there was no single place
// wrapping `fetch`, so when the access token expired mid-session every action
// failed SILENTLY (the request 401'd, the service threw, nothing refreshed and
// nothing retried). `authenticatedFetch` is now the ONLY way services issue an
// authenticated request:
//
//   1. perform the request with the Bearer token;
//   2. on 401 → refresh via POST /api/auth/refresh-token (credentials: 'include',
//      so the httpOnly refresh cookie travels), broadcast TOKEN_REFRESHED so every
//      machine adopts the new token, and retry the original request ONCE;
//   3. if the refresh fails, or the retry still 401s → revoke the refresh cookie
//      (best-effort signout) and broadcast SESSION_EXPIRED (authMachine clears the
//      session, navigates to login and warns the user).
//
// RETRY CONTRACT (do not widen): the retry fires ONLY on a 401 *response*. Never
// on a rejection (timeout/abort/network) and never on 5xx. Several of these
// requests are non-idempotent POSTs (create turn / reminder / rating): replaying
// one whose outcome is unknown could double-book a turn. A 401 is safe to replay
// only because the server rejects it at the auth filter, before any handler runs.
//
// Guarantees: at most ONE retry per request (no amplification), a single
// in-flight refresh shared by concurrent 401s (no stampede in-tab) serialized
// across tabs by a Web Lock, never a refresh for the refresh endpoint itself (no
// recursion), and tokens NEVER leave memory (no localStorage/sessionStorage).
// ---------------------------------------------------------------------------

export interface AuthenticatedFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /**
   * Skip the default JSON Content-Type. Required for multipart/form-data uploads,
   * where the browser must set the boundary itself.
   */
  omitJsonContentType?: boolean;
}

/** Shape of the refresh-token response we depend on (subset of SignInResponse). */
interface RefreshTokenPayload {
  accessToken?: string;
  id?: string;
  role?: string;
}

/** Single in-flight refresh shared by every concurrent 401 (anti-stampede). */
let inFlightRefresh: Promise<string> | null = null;

const isRefreshTokenUrl = (url: string): boolean =>
  url.startsWith(buildApiUrl(API_CONFIG.ENDPOINTS.REFRESH_TOKEN));

const buildRequestInit = (accessToken: string, init: AuthenticatedFetchInit): RequestInit => {
  const { headers, omitJsonContentType, signal, ...rest } = init;

  return {
    ...rest,
    headers: {
      ...(omitJsonContentType ? {} : API_CONFIG.DEFAULT_HEADERS),
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    // A fresh timeout per attempt: the retry gets its own budget instead of
    // inheriting the (already partly consumed) signal of the first attempt.
    signal: signal ?? AbortSignal.timeout(API_CONFIG.TIMEOUT),
  };
};

// NOTE: `AuthService.refreshToken()` hits the SAME endpoint but is a different
// concern (app-boot session restore in `checkStoredAuth`, returns the full
// SignInResponse, broadcasts nothing). It intentionally lives in the service layer;
// this one lives in the interceptor because config/api must NOT depend upward on a
// service. Both are trivially "POST refresh-token, read accessToken" — keep them in
// step if the endpoint contract changes.
const requestRefresh = async (): Promise<string> => {
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.REFRESH_TOKEN), {
    ...getDefaultFetchOptions(),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed! Status: ${response.status}`);
  }

  const payload: RefreshTokenPayload | null = await response.json().catch(() => null);
  const accessToken = payload?.accessToken;

  if (!accessToken) {
    throw new Error('Token refresh failed: the response carried no access token');
  }

  // TOKEN_REFRESHED — NOT SET_AUTH. SET_AUTH means "a session just started" and
  // machines bootstrap on it (dataMachine kicks off its whole initial fetch chain
  // and flips loading.initializing, which remounts the dashboards mid-action).
  // A silent refresh must only swap the token in place: every token-holding
  // machine handles TOKEN_REFRESHED with a pure assign, no target, no refetch.
  // Nothing is persisted.
  orchestrator.send({ type: 'TOKEN_REFRESHED', accessToken });

  return accessToken;
};

// The refresh cookie is shared by every tab of the profile, and the backend
// ROTATES it on each refresh (revoking the presented one). Two tabs whose access
// tokens expire together would otherwise both present the same refresh token: one
// wins, the loser's token is already revoked → a spurious "sesión expirada" while
// the session is perfectly alive. A Web Lock serializes the refresh across tabs,
// so the loser runs afterwards and simply refreshes with the freshly rotated
// cookie. Chosen over "tolerate one failure + jittered retry" because it fixes the
// race instead of papering over it, and it degrades gracefully: where `navigator.locks`
// is unavailable (older Safari, non-secure contexts, jsdom) we just run unlocked,
// i.e. exactly today's behaviour.
const withCrossTabRefreshLock = async (run: () => Promise<string>): Promise<string> => {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;

  if (!locks?.request) {
    return run();
  }

  return locks.request('medibook-refresh-token', run) as Promise<string>;
};

const refreshAccessToken = (): Promise<string> => {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const pending = withCrossTabRefreshLock(requestRefresh);
  inFlightRefresh = pending;

  // Release the shared promise once settled — on success AND on failure. A leaked
  // rejected promise here would wedge every future request behind a dead refresh.
  void pending
    .catch(() => undefined)
    .finally(() => {
      if (inFlightRefresh === pending) {
        inFlightRefresh = null;
      }
    });

  return pending;
};

// The session is over, but the browser may still hold a LIVE refresh cookie (the
// backend rotates on every refresh, so after a successful refresh + 401'd retry the
// cookie we hold is the freshly rotated one — valid for days, httpOnly, auto-sent to
// /api/auth). Leaving it behind on a shared clinic workstation means the next person
// on that browser profile can silently mint access tokens against patient data.
// /api/auth/signout is permitAll, so this works even with a dead access token.
// Fire-and-forget: the logout UX must not wait on (or be blocked by) this.
const revokeRefreshCookie = (): void => {
  void fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SIGNOUT), {
    ...getDefaultFetchOptions(),
    method: 'POST',
  }).catch(() => undefined);
};

const notifySessionExpired = (): void => {
  revokeRefreshCookie();
  orchestrator.send({ type: 'SESSION_EXPIRED' });
};

/**
 * The single entry point for authenticated API calls. See the block comment above.
 *
 * Returns the `Response` (the caller keeps mapping !response.ok to its own domain
 * error, so `classifyApiError` behaviour is unchanged); transport rejections
 * (timeout/abort/network) propagate untouched.
 */
export const authenticatedFetch = async (
  url: string,
  accessToken: string,
  init: AuthenticatedFetchInit = {},
): Promise<Response> => {
  const response = await fetch(url, buildRequestInit(accessToken, init));

  // Not an auth problem, or the refresh endpoint itself answered 401 — never
  // refresh a refresh (that would recurse).
  if (response.status !== 401 || isRefreshTokenUrl(url)) {
    return response;
  }

  let refreshedToken: string;
  try {
    refreshedToken = await refreshAccessToken();
  } catch (error) {
    logger.error('[api] Session refresh failed, logging out:', error);
    notifySessionExpired();
    // Surface the original 401 so the caller still throws its usual error.
    return response;
  }

  const retried = await fetch(url, buildRequestInit(refreshedToken, init));

  if (retried.status === 401) {
    // A 401 with a token we just minted means the session is really gone.
    notifySessionExpired();
  }

  return retried;
};
