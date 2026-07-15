import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// FSEC-H2 — Plaintext http:// API base URL fallback.
// BASE_URL resolution is evaluated at module load, so each test stubs the
// relevant import.meta.env values, resets the module registry, and dynamically
// re-imports config/api to force re-evaluation under the stubbed environment.

const { orchestratorSend } = vi.hoisted(() => ({ orchestratorSend: vi.fn() }));

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: orchestratorSend,
    sendToMachine: vi.fn(),
  },
}));

const importApi = async () => await import('./api');

describe('config/api BASE_URL resolution (FSEC-H2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('in DEV', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('allows http://localhost', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://localhost:8080');
    });

    it('allows http://127.0.0.1', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8080');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://127.0.0.1:8080');
    });

    it('falls back to http://localhost:8080 when the env var is missing', async () => {
      vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('http://localhost:8080');
    });

    it('allows an https URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.medibook.example');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('https://api.medibook.example');
    });

    it('rejects a non-localhost http URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://api.medibook.example');
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });
  });

  describe('outside DEV (production)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', false);
    });

    it('accepts an https URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.medibook.example');
      const { API_CONFIG } = await importApi();
      expect(API_CONFIG.BASE_URL).toBe('https://api.medibook.example');
    });

    it('rejects a missing env var', async () => {
      vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });

    it('rejects an empty env var', async () => {
      vi.stubEnv('VITE_API_BASE_URL', '');
      await expect(importApi()).rejects.toThrow(/VITE_API_BASE_URL/);
    });

    it('rejects a plaintext http URL', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://api.medibook.example');
      await expect(importApi()).rejects.toThrow(/https/);
    });

    it('rejects http://localhost (no insecure fallback in production)', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
      await expect(importApi()).rejects.toThrow(/https/);
    });
  });

  it('preserves the public module shape (buildApiUrl, endpoints, authenticatedFetch)', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    const mod = await importApi();
    expect(typeof mod.buildApiUrl).toBe('function');
    expect(typeof mod.authenticatedFetch).toBe('function');
    expect(mod.API_CONFIG.ENDPOINTS.SIGNIN).toBe('/api/auth/signin');
    expect(mod.buildApiUrl('/api/auth/signin')).toBe('http://localhost:8080/api/auth/signin');
  });

  // FBUG-H3 — the dead RESERVE_TURN reserve flow was removed frontend + backend.
  it('no longer exposes the RESERVE_TURN endpoint', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    const { API_CONFIG } = await importApi();
    const endpoints = API_CONFIG.ENDPOINTS as Record<string, string>;
    expect('RESERVE_TURN' in endpoints).toBe(false);
    expect(Object.values(endpoints)).not.toContain('/api/turns/reserve');
  });

  // FSEC-H1 Stage 2 — the refresh cookie is httpOnly and travels only when
  // fetch opts in with credentials: 'include'. Both the default (unauthenticated
  // signin/refresh/signout) and the authenticated request options must include it.
  describe('credentials: include (FSEC-H1)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    });

    it("getDefaultFetchOptions sends credentials: 'include'", async () => {
      const { getDefaultFetchOptions } = await importApi();
      expect(getDefaultFetchOptions().credentials).toBe('include');
    });

    // FBUG-003 — `getAuthenticatedFetchOptions` is gone: hand-building the Bearer
    // options is what let services bypass the 401 -> refresh -> retry interceptor.
    it('no longer exposes getAuthenticatedFetchOptions (authenticatedFetch is the only door)', async () => {
      const mod = await importApi();
      expect(
        (mod as Record<string, unknown>).getAuthenticatedFetchOptions,
      ).toBeUndefined();
    });

    it('no longer exposes getAuthenticatedFetchOptionsWithRefreshToken', async () => {
      const mod = await importApi();
      expect(
        (mod as Record<string, unknown>).getAuthenticatedFetchOptionsWithRefreshToken,
      ).toBeUndefined();
    });
  });

  // FBUG-M6 — shared error classifier. AbortSignal.timeout rejections and other
  // transport failures must be mapped uniformly to a localized message instead of
  // leaking raw/undefined error text, so every machine can consume the same map.
  describe('classifyApiError (FBUG-M6)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    });

    it('maps an AbortSignal.timeout TimeoutError to a timeout message', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();
      const err = new DOMException('The operation timed out.', 'TimeoutError');

      const result = classifyApiError(err);

      expect(result.kind).toBe('timeout');
      expect(result.message).toBe(API_ERROR_MESSAGES.timeout);
    });

    it('maps a manual AbortError to a timeout message', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();
      const err = new DOMException('Aborted', 'AbortError');

      const result = classifyApiError(err);

      expect(result.kind).toBe('timeout');
      expect(result.message).toBe(API_ERROR_MESSAGES.timeout);
    });

    it('maps a 401 error to the unauthorized message', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();

      const result = classifyApiError(new Error('Request failed with status 401'));

      expect(result.kind).toBe('unauthorized');
      expect(result.status).toBe(401);
      expect(result.message).toBe(API_ERROR_MESSAGES.unauthorized);
    });

    it('maps an "unauthorized" message to the unauthorized message', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();

      const result = classifyApiError(new Error('Unauthorized'));

      expect(result.kind).toBe('unauthorized');
      expect(result.message).toBe(API_ERROR_MESSAGES.unauthorized);
    });

    // The backend AccessDeniedHandler now returns a JSON body for 403
    // ({"error":"FORBIDDEN","message":"Access denied"}) instead of an empty one.
    // A 403 is an authorization denial, never a session expiry.
    it('maps the backend "Access denied" 403 body to the forbidden kind (not unauthorized)', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();

      const result = classifyApiError(new Error('Access denied'));

      expect(result.kind).toBe('forbidden');
      expect(result.status).toBe(403);
      expect(result.message).toBe(API_ERROR_MESSAGES.forbidden);
    });

    it('maps a "Status: 403" message to the forbidden kind', async () => {
      const { classifyApiError } = await importApi();

      const result = classifyApiError(new Error('Failed to fetch patients! Status: 403'));

      expect(result.kind).toBe('forbidden');
      expect(result.status).toBe(403);
    });

    it('maps a FORBIDDEN error code to the forbidden kind', async () => {
      const { classifyApiError } = await importApi();

      expect(classifyApiError(new Error('FORBIDDEN')).kind).toBe('forbidden');
    });

    it('maps a fetch TypeError to the network message', async () => {
      const { classifyApiError, API_ERROR_MESSAGES } = await importApi();

      const result = classifyApiError(new TypeError('Failed to fetch'));

      expect(result.kind).toBe('network');
      expect(result.message).toBe(API_ERROR_MESSAGES.network);
    });

    it('preserves a generic Error message under the unknown kind', async () => {
      const { classifyApiError } = await importApi();

      const result = classifyApiError(new Error('Boom specific'));

      expect(result.kind).toBe('unknown');
      expect(result.message).toBe('Boom specific');
    });

    it('uses the provided fallback message for non-Error rejections', async () => {
      const { classifyApiError } = await importApi();

      const result = classifyApiError('some string', 'Error al cargar doctores');

      expect(result.kind).toBe('unknown');
      expect(result.message).toBe('Error al cargar doctores');
    });
  });
});

// FBUG-003 — centralized 401 → refresh → retry interceptor.
// Before this, no single place wrapped fetch: a mid-session access-token expiry
// made every action fail silently (no refresh, no retry, no re-login). All
// services now go through `authenticatedFetch`.
describe('authenticatedFetch (FBUG-003 — 401 → refresh → retry)', () => {
  const BASE = 'http://localhost:8080';
  const PROTECTED_URL = `${BASE}/api/doctors/doctor-1/availability`;
  const REFRESH_URL = `${BASE}/api/auth/refresh-token`;
  const SIGNOUT_URL = `${BASE}/api/auth/signout`;

  const STALE_TOKEN = 'stale-access-token';
  const FRESH_TOKEN = 'fresh-access-token';

  const REFRESH_BODY = {
    id: 'user-1',
    role: 'DOCTOR',
    status: 'ACTIVE',
    accessToken: FRESH_TOKEN,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  const makeResponse = (status: number, body: unknown = {}): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  const authHeaderOf = (init: RequestInit | undefined): string | undefined =>
    (init?.headers as Record<string, string> | undefined)?.Authorization;

  const callsTo = (url: string) => fetchMock.mock.calls.filter(([called]) => called === url);

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
    orchestratorSend.mockClear();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sends the Bearer token and credentials on the happy path (no refresh)', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(PROTECTED_URL);
    expect(init.method).toBe('GET');
    expect(authHeaderOf(init)).toBe(`Bearer ${STALE_TOKEN}`);
    expect(init.credentials).toBe('include');
    expect(callsTo(REFRESH_URL)).toHaveLength(0);
  });

  it('on 401 refreshes the token and retries the original request exactly once', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, { saved: true })
        : makeResponse(401, { message: 'Unauthorized' });
    });
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ saved: true });

    // original (401) + refresh + retry = 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    expect(callsTo(PROTECTED_URL)).toHaveLength(2);

    const retryInit = callsTo(PROTECTED_URL)[1][1] as RequestInit;
    expect(authHeaderOf(retryInit)).toBe(`Bearer ${FRESH_TOKEN}`);
    expect(retryInit.method).toBe('POST');
    expect(retryInit.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('refreshes with credentials so the httpOnly refresh cookie travels', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, {})
        : makeResponse(401, {});
    });
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    const refreshInit = callsTo(REFRESH_URL)[0][1] as RequestInit;
    expect(refreshInit.method).toBe('POST');
    expect(refreshInit.credentials).toBe('include');
  });

  it('broadcasts TOKEN_REFRESHED (never SET_AUTH) so machines swap the token without re-bootstrapping', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, {})
        : makeResponse(401, {});
    });
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(orchestratorSend).toHaveBeenCalledWith({
      type: 'TOKEN_REFRESHED',
      accessToken: FRESH_TOKEN,
    });
    // SET_AUTH means "a session just started": it re-bootstraps dataMachine
    // (loading.initializing -> dashboards remount mid-action + refetch storm).
    expect(orchestratorSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_AUTH' }),
    );
  });

  it('never persists tokens to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, {})
        : makeResponse(401, {});
    });
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('logs out (session expired) when the refresh fails, without looping', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === REFRESH_URL) return makeResponse(401, { message: 'Invalid refresh token' });
      return makeResponse(401, { message: 'Unauthorized' });
    });
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    // The original 401 is surfaced to the caller (which throws its usual error).
    expect(response.status).toBe(401);
    // original + refresh only — the request is NOT retried when the refresh fails.
    expect(callsTo(PROTECTED_URL)).toHaveLength(1);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' });
  });

  it('logs out when the retry still returns 401 (max one retry)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return makeResponse(401, { message: 'Unauthorized' });
    });
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(response.status).toBe(401);
    // original + refresh + single retry — no further attempts.
    expect(callsTo(PROTECTED_URL)).toHaveLength(2);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' });
  });

  it('shares ONE refresh between concurrent 401s (anti-stampede)', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, { ok: true })
        : makeResponse(401, { message: 'Unauthorized' });
    });
    const { authenticatedFetch } = await importApi();

    const [first, second, third] = await Promise.all([
      authenticatedFetch(`${BASE}/api/turns/my-turns`, STALE_TOKEN, { method: 'GET' }),
      authenticatedFetch(`${BASE}/api/notifications`, STALE_TOKEN, { method: 'GET' }),
      authenticatedFetch(`${BASE}/api/doctors`, STALE_TOKEN, { method: 'GET' }),
    ]);

    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
  });

  it('allows a new refresh after the previous one settled', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
      return authHeaderOf(init) === `Bearer ${FRESH_TOKEN}`
        ? makeResponse(200, {})
        : makeResponse(401, {});
    });
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });
    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(callsTo(REFRESH_URL)).toHaveLength(2);
  });

  it('does not recurse when the refresh-token endpoint itself answers 401', async () => {
    fetchMock.mockResolvedValue(makeResponse(401, { message: 'Invalid refresh token' }));
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(REFRESH_URL, STALE_TOKEN, { method: 'POST' });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(orchestratorSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_AUTH' }),
    );
  });

  // A 403 is a real authorization denial (wrong role / cross-tenant), not an
  // expiry: refreshing would be pointless and would mask the denial.
  it('never refreshes on 403 (authorization denial, not expiry)', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(403, { error: 'FORBIDDEN', message: 'Access denied' }),
    );
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callsTo(REFRESH_URL)).toHaveLength(0);
    expect(orchestratorSend).not.toHaveBeenCalled();
  });

  it('passes non-401 errors through untouched (no refresh, no retry)', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { message: 'Server error' }));
    const { authenticatedFetch } = await importApi();

    const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callsTo(REFRESH_URL)).toHaveLength(0);
    expect(orchestratorSend).not.toHaveBeenCalled();
  });

  it('propagates transport rejections so callers can classifyApiError them', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError');
    fetchMock.mockRejectedValueOnce(timeout);
    const { authenticatedFetch, classifyApiError, API_ERROR_MESSAGES } = await importApi();

    await expect(
      authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' }),
    ).rejects.toBe(timeout);

    expect(classifyApiError(timeout).message).toBe(API_ERROR_MESSAGES.timeout);
    expect(callsTo(REFRESH_URL)).toHaveLength(0);
  });

  // The backend ROTATES the refresh cookie on every refresh and only revokes the
  // token it was presented. After refresh-ok → retry-401 the browser still holds a
  // freshly rotated, valid-for-days httpOnly cookie. Leaving it alive on a shared
  // clinic workstation lets the next person silently mint access tokens.
  describe('refresh-cookie revocation on session expiry', () => {
    it('fires a best-effort signout when the refresh fails', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === SIGNOUT_URL) return makeResponse(200, {});
        return makeResponse(401, { message: 'Unauthorized' });
      });
      const { authenticatedFetch } = await importApi();

      await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

      expect(callsTo(SIGNOUT_URL)).toHaveLength(1);
      const signoutInit = callsTo(SIGNOUT_URL)[0][1] as RequestInit;
      expect(signoutInit.method).toBe('POST');
      // the httpOnly refresh cookie must travel, or nothing gets revoked
      expect(signoutInit.credentials).toBe('include');
    });

    it('revokes the freshly rotated cookie when the retry still 401s', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === SIGNOUT_URL) return makeResponse(200, {});
        if (url === REFRESH_URL) return makeResponse(200, REFRESH_BODY);
        return makeResponse(401, { message: 'Unauthorized' });
      });
      const { authenticatedFetch } = await importApi();

      await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

      expect(callsTo(SIGNOUT_URL)).toHaveLength(1);
      expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' });
    });

    it('does not signout on a healthy request', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
      const { authenticatedFetch } = await importApi();

      await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

      expect(callsTo(SIGNOUT_URL)).toHaveLength(0);
    });

    it('survives a signout that itself fails (fire-and-forget)', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === SIGNOUT_URL) throw new TypeError('Failed to fetch');
        return makeResponse(401, { message: 'Unauthorized' });
      });
      const { authenticatedFetch } = await importApi();

      const response = await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });

      expect(response.status).toBe(401);
      expect(orchestratorSend).toHaveBeenCalledWith({ type: 'SESSION_EXPIRED' });
    });
  });

  // A rejected in-flight refresh promise that is never released would wedge every
  // future request behind a dead refresh for the lifetime of the tab.
  it('releases the in-flight refresh after a FAILED refresh (no permanent wedge)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === SIGNOUT_URL) return makeResponse(200, {});
      if (url === REFRESH_URL) return makeResponse(401, { message: 'Invalid refresh token' });
      return makeResponse(401, { message: 'Unauthorized' });
    });
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });
    expect(callsTo(REFRESH_URL)).toHaveLength(1);

    // A later request must be able to try again (e.g. after a re-login in another tab)
    // rather than reusing the settled, rejected promise forever.
    await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'GET' });
    expect(callsTo(REFRESH_URL)).toHaveLength(2);
  });

  // RETRY CONTRACT — the retry must fire ONLY on a 401 *response*. These POSTs are
  // non-idempotent (create turn / reminder / rating): replaying one whose outcome is
  // unknown could double-book a turn.
  describe('retry contract (non-idempotent POSTs must not be replayed)', () => {
    it('does not retry a 500', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(500, { message: 'Boom' }));
      const { authenticatedFetch } = await importApi();

      await authenticatedFetch(PROTECTED_URL, STALE_TOKEN, {
        method: 'POST',
        body: JSON.stringify({ turnId: 't1' }),
      });

      expect(callsTo(PROTECTED_URL)).toHaveLength(1);
      expect(callsTo(REFRESH_URL)).toHaveLength(0);
    });

    it('does not retry a timeout/abort rejection', async () => {
      fetchMock.mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'));
      const { authenticatedFetch } = await importApi();

      await expect(
        authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'POST' }),
      ).rejects.toThrow();

      expect(callsTo(PROTECTED_URL)).toHaveLength(1);
      expect(callsTo(REFRESH_URL)).toHaveLength(0);
    });

    it('does not retry a network rejection', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const { authenticatedFetch } = await importApi();

      await expect(
        authenticatedFetch(PROTECTED_URL, STALE_TOKEN, { method: 'POST' }),
      ).rejects.toThrow();

      expect(callsTo(PROTECTED_URL)).toHaveLength(1);
      expect(callsTo(REFRESH_URL)).toHaveLength(0);
    });
  });

  it('omits the JSON Content-Type for multipart uploads when asked', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}));
    const { authenticatedFetch } = await importApi();

    await authenticatedFetch(`${BASE}/api/storage/upload-turn-file`, STALE_TOKEN, {
      method: 'POST',
      body: new FormData(),
      omitJsonContentType: true,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe(`Bearer ${STALE_TOKEN}`);
  });
});
