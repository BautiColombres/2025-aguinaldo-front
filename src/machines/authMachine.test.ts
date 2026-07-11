import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';

// Mock dependencies BEFORE importing the machine
vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    registerMachine: vi.fn(),
  }
}));

vi.mock('../service/auth-service.service', () => ({
  AuthService: {
    saveAuthData: vi.fn(),
    refreshToken: vi.fn()
  }
}));

vi.mock('../utils/authFormValidation', () => ({
  validateField: vi.fn(),
  checkFormValidation: vi.fn()
}));

vi.mock('../utils/MachineUtils/authMachineUtils', () => ({
  checkStoredAuth: vi.fn(),
  submitAuthentication: vi.fn(),
  logoutUser: vi.fn()
}));

import { authMachine } from './authMachine';
import { orchestrator } from '#/core/Orchestrator';
import { AuthService } from '../service/auth-service.service';
import { checkStoredAuth, logoutUser, submitAuthentication } from '../utils/MachineUtils/authMachineUtils';
import { validateField, checkFormValidation } from '../utils/authFormValidation';

describe('authMachine', () => {
  let actor: any;
  let mockOrchestrator: any;
  let mockFormValidation: any;

  beforeEach(() => {
    vi.useFakeTimers(); // Enable fake timers for all tests
    // Get mocked modules
    mockOrchestrator = vi.mocked(orchestrator);
    mockFormValidation = vi.mocked({ validateField, checkFormValidation });

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(checkStoredAuth).mockResolvedValue({
      authData: null,
      isAuthenticated: false
    });
    mockFormValidation.validateField.mockReturnValue('');
    mockFormValidation.checkFormValidation.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (actor) {
      actor.stop();
    }
  });

  describe('initial state', () => {
    it('should start in checkingAuth state and transition to idle when not authenticated', async () => {
      actor = createActor(authMachine);
      actor.start();

      // Should start in checkingAuth state
      expect(actor.getSnapshot().value).toBe('checkingAuth');

      // Wait for async transition to complete
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });
    });

    it('should check stored auth on initialization', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(vi.mocked(checkStoredAuth)).toHaveBeenCalled();
        expect(actor.getSnapshot().context.isAuthenticated).toBe(true);
      });
    });
  });

  describe('checkingAuth state', () => {
    it('should transition to authenticated when user is authenticated', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'ACTIVE' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
        expect(actor.getSnapshot().context.isAuthenticated).toBe(true);
      });
    });

    it('should transition to idle when user is not authenticated', async () => {
      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
        expect(actor.getSnapshot().context.isAuthenticated).toBe(false);
      });
    });

    it('should navigate to pending activation for inactive users', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'PENDING' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });

      // Wait for the setTimeout to execute
      vi.runAllTimers();

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'NAVIGATE',
        to: '/pending-activation'
      });
    });

    it('should set auth data for active users', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'ACTIVE' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });

      vi.runAllTimers();

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: '1',
        userRole: 'PATIENT'
      });
    });
  });

  // FBUG-L2 — the session-expired snackbar must read its data from the resolved
  // event (event.output), regardless of the order the onDone actions run in.
  describe('checkingAuth expired session (FBUG-L2)', () => {
    it('opens the session-expired snackbar from the event, independent of action ordering', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT' },
        isAuthenticated: false,
      });

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'OPEN_SNACKBAR',
        message: 'Sesión expirada. Por favor, vuelve a iniciar sesión.',
        severity: 'warning',
      });
    });
  });

  describe('authenticated state', () => {
    beforeEach(async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'ACTIVE' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();
      
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });
    });

    it('should handle LOGOUT event', () => {
      actor.send({ type: 'LOGOUT' });

      expect(actor.getSnapshot().value).toBe('loggingOut');
    });

    it('should handle HANDLE_AUTH_ERROR event', () => {
      actor.send({ type: 'HANDLE_AUTH_ERROR', error: new Error('Token expired') });

      expect(actor.getSnapshot().value).toBe('refreshingToken');
    });
  });

  describe('loggingOut state', () => {
    beforeEach(async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'ACTIVE' },
        isAuthenticated: true
      });

      actor = createActor(authMachine);
      actor.start();
      
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });
      
      actor.send({ type: 'LOGOUT' });
    });

    it('should call logoutUser and transition to idle on success', async () => {
      vi.mocked(logoutUser).mockResolvedValue(true);

      // Wait for the promise to resolve
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(vi.mocked(logoutUser)).toHaveBeenCalled();
      expect(actor.getSnapshot().context.isAuthenticated).toBe(false);
      expect(actor.getSnapshot().context.authResponse).toBe(null);
      expect(mockOrchestrator.send).toHaveBeenCalledWith({ type: 'NAVIGATE', to: '/' });
    });

    it('should transition to idle on logout error', async () => {
      vi.mocked(logoutUser).mockRejectedValue(new Error('Logout failed'));

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      expect(actor.getSnapshot().context.isAuthenticated).toBe(false);
      expect(mockOrchestrator.send).toHaveBeenCalledWith({ type: 'NAVIGATE', to: '/' });
    });
  });

  describe('idle state', () => {
    beforeEach(() => {
      actor = createActor(authMachine);
      actor.start();
    });

    it('should handle UPDATE_FORM event', () => {
      mockFormValidation.validateField.mockReturnValue('Invalid email');
      mockFormValidation.checkFormValidation.mockReturnValue(false);

      actor.send({ type: 'UPDATE_FORM', key: 'email', value: 'invalid-email' });

      expect(actor.getSnapshot().context.formValues.email).toBe('invalid-email');
      expect(actor.getSnapshot().context.formErrors?.email).toBe('Invalid email');
      expect(actor.getSnapshot().context.hasErrorsOrEmpty).toBe(false);
    });

    it('should handle TOGGLE_USER_TYPE event', () => {
      mockFormValidation.checkFormValidation.mockReturnValue(false);

      actor.send({ type: 'TOGGLE_USER_TYPE', isPatient: false });

      expect(actor.getSnapshot().context.isPatient).toBe(false);
      expect(actor.getSnapshot().context.hasErrorsOrEmpty).toBe(false);
    });

    it('should handle TOGGLE_MODE event', () => {
      actor.send({ type: 'TOGGLE_MODE', mode: 'register' });

      expect(actor.getSnapshot().context.mode).toBe('register');
      expect(actor.getSnapshot().context.hasErrorsOrEmpty).toBe(true);
      expect(actor.getSnapshot().context.formErrors).toEqual({});
      expect(actor.getSnapshot().context.authResponse).toBe(null);
      expect(actor.getSnapshot().context.loading).toBe(false);
    });

    it('should handle SUBMIT event', () => {
      // With default mocks (validateField returns no error), SUBMIT goes to validating then immediately to submitting
      actor.send({ type: 'SUBMIT' });

      expect(actor.getSnapshot().value).toBe('submitting');
    });
  });

  describe('validating state', () => {
    beforeEach(async () => {
      actor = createActor(authMachine);
      actor.start();
      
      // Wait for initial auth check to complete
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });
    });

    it('should transition to submitting when form is valid', () => {
      mockFormValidation.validateField.mockReturnValue('');
      mockFormValidation.checkFormValidation.mockReturnValue(false);

      actor.send({ type: 'SUBMIT' });

      // The transition should happen automatically based on the guard
      expect(actor.getSnapshot().value).toBe('submitting');
    });

    it('should transition to idle when form is invalid', () => {
      // Add a field that will be validated (starts with "user" since isPatient is true)
      actor.send({ type: 'UPDATE_FORM', key: 'userEmail', value: 'invalid-email' });
      mockFormValidation.validateField.mockReturnValue('Invalid email format');

      // Send SUBMIT - should go to validating, then immediately to idle due to invalid form
      actor.send({ type: 'SUBMIT' });

      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.hasErrorsOrEmpty).toBe(true);
    });

    // FBUG-C1: guard purity — the validating guard returns a boolean based on the
    // computed errors and does NOT rely on mutating context to surface them. The
    // guard must return false (stay/transition to idle) when validation fails.
    it('should return false from the guard (route to idle) when validation fails', () => {
      mockFormValidation.validateField.mockReturnValue('Invalid email format');
      actor.send({ type: 'UPDATE_FORM', key: 'userEmail', value: 'invalid-email' });

      actor.send({ type: 'SUBMIT' });

      // The valid-form guard evaluated to false, so we land in idle (not submitting).
      expect(actor.getSnapshot().value).toBe('idle');
    });

    // FBUG-C1: errors must still surface to the UI via the assign path (NOT via a
    // guard-side mutation, which was the deleted bug). Even after removing the
    // `context.formErrors = errors` mutation from the guard, formErrors stays populated.
    it('should still populate formErrors via the assign path when validation fails', () => {
      mockFormValidation.validateField.mockReturnValue('Invalid email format');
      actor.send({ type: 'UPDATE_FORM', key: 'userEmail', value: 'invalid-email' });

      actor.send({ type: 'SUBMIT' });

      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.formErrors.userEmail).toBe('Invalid email format');
    });
  });

  describe('submitting state', () => {
    beforeEach(async () => {
      // Keep the submit in-flight so we can observe the submitting entry state
      // (a resolved promise would immediately advance to authenticated/idle).
      vi.mocked(submitAuthentication).mockReturnValue(new Promise(() => {}));

      actor = createActor(authMachine);
      actor.start();

      // Wait for initial auth check to complete
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.send({ type: 'TOGGLE_MODE', mode: 'login' });
      actor.send({ type: 'SUBMIT' });
    });

    it('should set loading to true on entry', () => {
      expect(actor.getSnapshot().value).toBe('submitting');
      expect(actor.getSnapshot().context.loading).toBe(true);
    });
  });

  // FBUG-M5 — submitting.onError must build a fully typed ApiErrorResponse payload
  // (message/error), not an untyped partial assign.
  describe('submitting onError (FBUG-M5)', () => {
    it('produces a typed ApiErrorResponse on a general error', async () => {
      vi.mocked(submitAuthentication).mockRejectedValue(new Error('Credenciales inválidas'));

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.send({ type: 'TOGGLE_MODE', mode: 'login' });
      actor.send({ type: 'SUBMIT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.loading).toBe(false);
        expect(actor.getSnapshot().context.authResponse).toBeTruthy();
      });

      const authResponse = actor.getSnapshot().context.authResponse as {
        error?: string;
        message?: string;
      };

      expect(authResponse.error).toBe('Credenciales inválidas');
      expect(authResponse.message).toBe('Credenciales inválidas');
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('maps backend field errors while still setting a typed authResponse', async () => {
      const fieldError = Object.assign(new Error('validation'), {
        fieldErrors: { userEmail: 'Correo ya registrado' },
      });
      vi.mocked(submitAuthentication).mockRejectedValue(fieldError);

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.send({ type: 'TOGGLE_MODE', mode: 'login' });
      actor.send({ type: 'SUBMIT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.loading).toBe(false);
        expect(actor.getSnapshot().context.formErrors?.userEmail).toBe('Correo ya registrado');
      });

      const authResponse = actor.getSnapshot().context.authResponse as { error?: string };
      expect(authResponse.error).toBe('Por favor revise los campos marcados con error');
    });
  });

  // FSEC-H1 Stage 2 — the single-choke-point + no-persistence invariants.
  describe('FSEC-H1 token storage', () => {
    it('login onDone must NOT persist tokens via saveAuthData', async () => {
      vi.mocked(submitAuthentication).mockResolvedValue({
        id: '1',
        role: 'PATIENT',
        status: 'ACTIVE',
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      } as any);

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.send({ type: 'TOGGLE_MODE', mode: 'login' });
      actor.send({ type: 'SUBMIT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });

      expect(actor.getSnapshot().context.isAuthenticated).toBe(true);
      expect(vi.mocked(AuthService.saveAuthData)).not.toHaveBeenCalled();
    });

    it('refreshingToken calls cookie-based AuthService.refreshToken() with no argument and does not persist', async () => {
      vi.mocked(checkStoredAuth).mockResolvedValue({
        authData: { accessToken: 'token123', id: '1', role: 'PATIENT', status: 'ACTIVE' },
        isAuthenticated: true
      });
      vi.mocked(AuthService.refreshToken).mockResolvedValue({
        id: '1',
        role: 'PATIENT',
        status: 'ACTIVE',
        accessToken: 'new-access-token'
      } as any);

      actor = createActor(authMachine);
      actor.start();

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });

      actor.send({ type: 'HANDLE_AUTH_ERROR', error: new Error('Token expired') });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('authenticated');
      });

      expect(vi.mocked(AuthService.refreshToken)).toHaveBeenCalledWith();
      expect(vi.mocked(AuthService.saveAuthData)).not.toHaveBeenCalled();
    });
  });

  describe('context management', () => {
    it('should initialize with default context', async () => {
      actor = createActor(authMachine);
      actor.start();

      // Wait for initial auth check to complete
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      const context = actor.getSnapshot().context;
      expect(context.mode).toBe('login');
      expect(context.isPatient).toBe(true);
      expect(context.hasErrorsOrEmpty).toBe(true);
      expect(context.isAuthenticated).toBe(false);
      expect(context.loading).toBe(false);
      expect(context.formValues.email).toBe('');
      expect(context.formErrors).toEqual({});
    });

    it('should maintain context across state transitions', async () => {
      actor = createActor(authMachine);
      actor.start();

      // Wait for initial auth check to complete
      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.send({ type: 'UPDATE_FORM', key: 'email', value: 'test@example.com' });
      actor.send({ type: 'TOGGLE_USER_TYPE', isPatient: false });

      expect(actor.getSnapshot().context.formValues.email).toBe('test@example.com');
      expect(actor.getSnapshot().context.isPatient).toBe(false);
    });
  });
});
