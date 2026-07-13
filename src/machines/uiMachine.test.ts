import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';

// Mock dependencies BEFORE importing the machine
vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    sendToMachine: vi.fn(),
    getSnapshot: vi.fn(),
    registerMachine: vi.fn(),
  }
}));

import { uiMachine } from './uiMachine';
import { orchestrator } from '#/core/Orchestrator';

describe('uiMachine', () => {
  let actor: any;
  let mockOrchestrator: any;
  let mockNavigate: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Get mocked modules
    mockOrchestrator = vi.mocked(orchestrator);
    mockNavigate = vi.fn();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in idle state with default context', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.currentPath).toBe('/');
      expect(actor.getSnapshot().context.snackbar.open).toBe(false);
      expect(actor.getSnapshot().context.confirmDialog.open).toBe(false);
    });

    it('should initialize with default toggle states', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const toggleStates = actor.getSnapshot().context.toggleStates;
      expect(toggleStates.loadingApprove).toBe(false);
      expect(toggleStates.loadingReject).toBe(false);
    });

    it('should have a default navigate function', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      expect(typeof actor.getSnapshot().context.navigate).toBe('function');
    });
  });

  describe('ADD_NAVIGATE_HOOK Event', () => {
    it('should set navigate function from event', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/dashboard',
      });

      expect(actor.getSnapshot().context.navigate).toBe(mockNavigate);
      expect(actor.getSnapshot().context.currentPath).toBe('/dashboard');
    });

    it('should use default path if initialPath is not provided', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '',
      });

      expect(actor.getSnapshot().context.currentPath).toBe('/');
    });

    it('should handle patient detail navigation on initial path', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/patient-detail?patientId=patient123',
      });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient123'
      });
    });

    it('should send CLEAR_PATIENT_SELECTION when navigating to patient detail without patientId', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient-detail?patientId=' });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'CLEAR_PATIENT_SELECTION'
      });
    });

    it('should parse patientId via URLSearchParams when extra params follow it (initial path)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/patient-detail?patientId=patient123&foo=bar&baz=qux',
      });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient123'
      });
    });

    it('should parse patientId when it is not the first query param (initial path)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/patient-detail?foo=bar&patientId=patient777',
      });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient777'
      });
    });

    it('should handle turn cancellation from patient view turns', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/patient/view-turns?turnId=turn456',
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'CHECK_URL_CANCEL_TURN',
        turnId: 'turn456'
      });
    });

    it('should handle turn cancellation from doctor view turns', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/doctor/view-turns?turnId=turn789',
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'CHECK_URL_CANCEL_TURN',
        turnId: 'turn789'
      });
    });

  describe('TOGGLE Event', () => {
    it('should toggle a boolean state from false to true', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });

      expect(actor.getSnapshot().context.toggleStates.loadingApprove).toBe(true);
    });

    it('should toggle a boolean state from true to false', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });
      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });

      expect(actor.getSnapshot().context.toggleStates.loadingApprove).toBe(false);
    });

    it('should toggle multiple independent states', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });
      actor.send({ type: 'TOGGLE', key: 'loadingReject' });

      const toggleStates = actor.getSnapshot().context.toggleStates;
      expect(toggleStates.loadingApprove).toBe(true);
      expect(toggleStates.loadingReject).toBe(true);
    });

    it('should create new toggle state if key does not exist', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'customToggle' });

      expect(actor.getSnapshot().context.toggleStates.customToggle).toBe(true);
    });

    it('should preserve other toggle states when toggling one', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });
      actor.send({ type: 'TOGGLE', key: 'loadingReject' });

      const toggleStates = actor.getSnapshot().context.toggleStates;
      expect(toggleStates.loadingApprove).toBe(true);
      expect(toggleStates.loadingReject).toBe(true);
    });
  });

  describe('NAVIGATE Event', () => {
    it('should call navigate function with path', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/',
      });

      actor.send({ type: 'NAVIGATE', to: '/dashboard' });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should update currentPath after navigation', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/',
      });

      actor.send({ type: 'NAVIGATE', to: '/profile' });

      expect(actor.getSnapshot().context.currentPath).toBe('/profile');
    });

    it('should not navigate if path is null', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      const initialPath = actor.getSnapshot().context.currentPath;
      actor.send({ type: 'NAVIGATE', to: null });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(actor.getSnapshot().context.currentPath).toBe(initialPath);
    });

    it('should navigate to multiple paths sequentially', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/',
      });

      actor.send({ type: 'NAVIGATE', to: '/page1' });
      actor.send({ type: 'NAVIGATE', to: '/page2' });
      actor.send({ type: 'NAVIGATE', to: '/page3' });

      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockNavigate).toHaveBeenNthCalledWith(1, '/page1');
      expect(mockNavigate).toHaveBeenNthCalledWith(2, '/page2');
      expect(mockNavigate).toHaveBeenNthCalledWith(3, '/page3');
      expect(actor.getSnapshot().context.currentPath).toBe('/page3');
    });

    it('should handle navigation to patient detail during NAVIGATE event', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient-detail?patientId=patient999' });

      expect(mockNavigate).toHaveBeenCalledWith('/patient-detail?patientId=patient999');
      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient999'
      });
    });

    it('should send CLEAR_PATIENT_SELECTION when navigating to patient detail without patientId', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient-detail?patientId=' });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'CLEAR_PATIENT_SELECTION'
      });
    });

    it('should parse patientId via URLSearchParams when extra params follow it (NAVIGATE)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient-detail?patientId=patient555&tab=history' });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient555'
      });
    });

    it('should parse patientId when it is not the first query param (NAVIGATE)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient-detail?tab=history&patientId=patient888' });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'SELECT_PATIENT',
        patientId: 'patient888'
      });
    });

    it('should produce a new context via assign instead of mutating the previous one', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      const contextBefore = actor.getSnapshot().context;
      expect(contextBefore.currentPath).toBe('/home');

      actor.send({ type: 'NAVIGATE', to: '/profile' });

      const contextAfter = actor.getSnapshot().context;

      expect(contextAfter).not.toBe(contextBefore);
      expect(contextBefore.currentPath).toBe('/home');
      expect(contextAfter.currentPath).toBe('/profile');
    });

    it('should call navigate exactly once with the target path', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'NAVIGATE', to: '/profile' });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });
  });

  describe('OPEN_SNACKBAR Event', () => {
    it('should open snackbar with success message', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Operation successful',
        severity: 'success',
      });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.open).toBe(true);
      expect(snackbar.message).toBe('Operation successful');
      expect(snackbar.severity).toBe('success');
    });

    it('should open snackbar with error message', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'An error occurred',
        severity: 'error',
      });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.open).toBe(true);
      expect(snackbar.message).toBe('An error occurred');
      expect(snackbar.severity).toBe('error');
    });

    it('should open snackbar with warning message', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Warning message',
        severity: 'warning',
      });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.open).toBe(true);
      expect(snackbar.message).toBe('Warning message');
      expect(snackbar.severity).toBe('warning');
    });

    it('should open snackbar with info message', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Info message',
        severity: 'info',
      });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.open).toBe(true);
      expect(snackbar.message).toBe('Info message');
      expect(snackbar.severity).toBe('info');
    });

    it('should NOT schedule a machine-side auto-close timer (FBUG-L4)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Auto close test',
        severity: 'info',
      });

      expect(actor.getSnapshot().context.snackbar.open).toBe(true);

      vi.advanceTimersByTime(6000);

      expect(mockOrchestrator.send).not.toHaveBeenCalledWith({ type: 'CLOSE_SNACKBAR' });
    });

    it('should replace previous snackbar message', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'First message',
        severity: 'info',
      });

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Second message',
        severity: 'success',
      });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.message).toBe('Second message');
      expect(snackbar.severity).toBe('success');
    });
  });

  describe('CLOSE_SNACKBAR Event', () => {
    it('should close snackbar', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Test message',
        severity: 'info',
      });

      expect(actor.getSnapshot().context.snackbar.open).toBe(true);

      actor.send({ type: 'CLOSE_SNACKBAR' });

      expect(actor.getSnapshot().context.snackbar.open).toBe(false);
    });

    it('should send NOTIFICATION_CLOSED event to orchestrator', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Test message',
        severity: 'info',
      });

      actor.send({ type: 'CLOSE_SNACKBAR' });

      expect(mockOrchestrator.send).toHaveBeenCalledWith({ type: 'NOTIFICATION_CLOSED' });
    });

    it('should preserve snackbar message and severity when closing', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Test message',
        severity: 'success',
      });

      actor.send({ type: 'CLOSE_SNACKBAR' });

      const snackbar = actor.getSnapshot().context.snackbar;
      expect(snackbar.open).toBe(false);
      expect(snackbar.message).toBe('Test message');
      expect(snackbar.severity).toBe('success');
    });
  });

  describe('OPEN_CONFIRMATION_DIALOG Event', () => {
    it('should open confirmation dialog for approve action', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'approve',
        requestId: 'request-123',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('approve');
      expect(confirmDialog.requestId).toBe('request-123');
    });

    it('should open confirmation dialog for reject action', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'reject',
        requestId: 'request-456',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('reject');
      expect(confirmDialog.requestId).toBe('request-456');
    });

    it('should replace previous confirmation dialog', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'approve',
        requestId: 'request-1',
      });

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'reject',
        requestId: 'request-2',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.action).toBe('reject');
      expect(confirmDialog.requestId).toBe('request-2');
    });
  });

  describe('CLOSE_CONFIRMATION_DIALOG Event', () => {
    it('should close confirmation dialog', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'approve',
        requestId: 'request-123',
      });

      expect(actor.getSnapshot().context.confirmDialog.open).toBe(true);

      actor.send({ type: 'CLOSE_CONFIRMATION_DIALOG' });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(false);
      // Data should still be present after close (during animation)
      expect(confirmDialog.action).toBe('approve');
      expect(confirmDialog.requestId).toBe('request-123');
      
      // After clear event, data should be null
      actor.send({ type: 'CLEAR_CONFIRMATION_DIALOG' });
      const clearedDialog = actor.getSnapshot().context.confirmDialog;
      expect(clearedDialog.action).toBeNull();
      expect(clearedDialog.requestId).toBeNull();
    });

    it('should reset all confirmation dialog properties', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'reject',
        requestId: 'request-789',
      });

      actor.send({ type: 'CLOSE_CONFIRMATION_DIALOG' });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog).toEqual({
        open: false,
        action: 'reject',
        requestId: 'request-789',
        turnId: null,
        turnData: null,
        title: 'Confirmar Acción',
        message: '',
        confirmButtonText: 'Confirmar',
        confirmButtonColor: 'primary',
      });
      
      // After clear event, all data should be reset
      actor.send({ type: 'CLEAR_CONFIRMATION_DIALOG' });
      const clearedDialog = actor.getSnapshot().context.confirmDialog;
      expect(clearedDialog).toEqual({
        open: false,
        action: null,
        requestId: null,
        turnId: null,
        turnData: null,
        title: undefined,
        message: undefined,
        confirmButtonText: undefined,
        confirmButtonColor: undefined,
      });
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Test',
        severity: 'success',
      });

      const context = actor.getSnapshot().context;
      expect(context.currentPath).toBe('/home');
      expect(context.toggleStates.loadingApprove).toBe(true);
      expect(context.snackbar.open).toBe(true);
    });

    it('should remain in idle state during all operations', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const events = [
        { type: 'TOGGLE', key: 'test' },
        { type: 'NAVIGATE', to: '/test' },
        { type: 'OPEN_SNACKBAR', message: 'Test', severity: 'info' },
        { type: 'CLOSE_SNACKBAR' },
        { type: 'OPEN_CONFIRMATION_DIALOG', action: 'approve', requestId: 'test' },
        { type: 'CLOSE_CONFIRMATION_DIALOG' },
      ];

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/',
      });

      events.forEach(event => {
        actor.send(event as any);
        expect(actor.getSnapshot().value).toBe('idle');
      });
    });
  });

  describe('Complex Workflows', () => {
    it('should handle navigation with snackbar notification', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/',
      });

      actor.send({ type: 'NAVIGATE', to: '/profile' });
      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Profile loaded',
        severity: 'success',
      });

      expect(mockNavigate).toHaveBeenCalledWith('/profile');
      expect(actor.getSnapshot().context.snackbar.message).toBe('Profile loaded');
    });

    it('should handle confirmation dialog with toggle states', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'loadingApprove' });
      actor.send({
        type: 'OPEN_CONFIRMATION_DIALOG',
        action: 'approve',
        requestId: 'req-1',
      });

      const context = actor.getSnapshot().context;
      expect(context.toggleStates.loadingApprove).toBe(true);
      expect(context.confirmDialog.open).toBe(true);
    });

    it('should not stack machine timers across rapid snackbars (FBUG-L4)', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'First message',
        severity: 'info',
      });

      vi.advanceTimersByTime(3000);

      actor.send({
        type: 'OPEN_SNACKBAR',
        message: 'Second message',
        severity: 'success',
      });

      vi.advanceTimersByTime(6000);

      expect(mockOrchestrator.send).not.toHaveBeenCalledWith({ type: 'CLOSE_SNACKBAR' });
      expect(actor.getSnapshot().context.snackbar.message).toBe('Second message');
    });
  });

  describe('Edge Cases', () => {
    it('should handle toggling undefined key', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'TOGGLE', key: 'nonExistentKey' });

      expect(actor.getSnapshot().context.toggleStates.nonExistentKey).toBe(true);
    });

    it('should handle closing snackbar when not open', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      expect(actor.getSnapshot().context.snackbar.open).toBe(false);

      actor.send({ type: 'CLOSE_SNACKBAR' });

      expect(actor.getSnapshot().context.snackbar.open).toBe(false);
      expect(mockOrchestrator.send).toHaveBeenCalledWith({ type: 'NOTIFICATION_CLOSED' });
    });

    it('should handle closing confirmation dialog when not open', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      expect(actor.getSnapshot().context.confirmDialog.open).toBe(false);

      actor.send({ type: 'CLOSE_CONFIRMATION_DIALOG' });

      expect(actor.getSnapshot().context.confirmDialog.open).toBe(false);
    });

    it('should handle empty string navigation path', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'ADD_NAVIGATE_HOOK',
        navigate: mockNavigate,
        initialPath: '/home',
      });

      const initialPath = actor.getSnapshot().context.currentPath;
      actor.send({ type: 'NAVIGATE', to: '' });

      // Empty string is falsy in the condition, so navigation should NOT happen
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(actor.getSnapshot().context.currentPath).toBe(initialPath);
    });
  });

  describe('OPEN_CANCEL_TURN_DIALOG Event', () => {
    it('should open cancel turn dialog with default parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_CANCEL_TURN_DIALOG',
        turnId: 'turn-123',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('cancel_turn');
      expect(confirmDialog.turnId).toBe('turn-123');
      expect(confirmDialog.turnData).toBeUndefined();
      expect(confirmDialog.title).toBe('Confirmar Acción');
      expect(confirmDialog.message).toBe('¿Estás seguro de que quieres cancelar este turno? Esta acción no se puede deshacer.');
      expect(confirmDialog.confirmButtonText).toBe('Cancelar Turno');
      expect(confirmDialog.confirmButtonColor).toBe('error');
    });

    it('should open cancel turn dialog with custom parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turnData = { patientName: 'John Doe', scheduledAt: '2024-01-01' };
      actor.send({
        type: 'OPEN_CANCEL_TURN_DIALOG',
        turnId: 'turn-456',
        turnData,
        title: 'Custom Title',
        message: 'Custom message',
        confirmButtonText: 'Custom Button',
        confirmButtonColor: 'warning',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('cancel_turn');
      expect(confirmDialog.turnId).toBe('turn-456');
      expect(confirmDialog.turnData).toEqual(turnData);
      expect(confirmDialog.title).toBe('Custom Title');
      expect(confirmDialog.message).toBe('Custom message');
      expect(confirmDialog.confirmButtonText).toBe('Custom Button');
      expect(confirmDialog.confirmButtonColor).toBe('warning');
    });
  });

  describe('OPEN_COMPLETE_TURN_DIALOG Event', () => {
    it('should open complete turn dialog with default parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_COMPLETE_TURN_DIALOG',
        turnId: 'turn-789',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('complete_turn');
      expect(confirmDialog.turnId).toBe('turn-789');
      expect(confirmDialog.turnData).toBeUndefined();
      expect(confirmDialog.title).toBe('Marcar Turno como Completado');
      expect(confirmDialog.message).toBe('¿Confirmas que este turno fue atendido exitosamente?');
      expect(confirmDialog.confirmButtonText).toBe('Marcar Completado');
      expect(confirmDialog.confirmButtonColor).toBe('success');
    });

    it('should open complete turn dialog with custom parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turnData = { patientName: 'Jane Smith', scheduledAt: '2024-01-02' };
      actor.send({
        type: 'OPEN_COMPLETE_TURN_DIALOG',
        turnId: 'turn-101',
        turnData,
        title: 'Custom Complete Title',
        message: 'Custom complete message',
        confirmButtonText: 'Custom Complete Button',
        confirmButtonColor: 'primary',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('complete_turn');
      expect(confirmDialog.turnId).toBe('turn-101');
      expect(confirmDialog.turnData).toEqual(turnData);
      expect(confirmDialog.title).toBe('Custom Complete Title');
      expect(confirmDialog.message).toBe('Custom complete message');
      expect(confirmDialog.confirmButtonText).toBe('Custom Complete Button');
      expect(confirmDialog.confirmButtonColor).toBe('primary');
    });
  });

  describe('OPEN_NO_SHOW_TURN_DIALOG Event', () => {
    it('should open no show turn dialog with default parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({
        type: 'OPEN_NO_SHOW_TURN_DIALOG',
        turnId: 'turn-111',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('no_show_turn');
      expect(confirmDialog.turnId).toBe('turn-111');
      expect(confirmDialog.turnData).toBeUndefined();
      expect(confirmDialog.title).toBe('Marcar Turno como No Asistió');
      expect(confirmDialog.message).toBe('¿Confirmas que el paciente no asistió a este turno?');
      expect(confirmDialog.confirmButtonText).toBe('No Asistió');
      expect(confirmDialog.confirmButtonColor).toBe('warning');
    });

    it('should open no show turn dialog with custom parameters', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turnData = { patientName: 'Bob Wilson', scheduledAt: '2024-01-03' };
      actor.send({
        type: 'OPEN_NO_SHOW_TURN_DIALOG',
        turnId: 'turn-222',
        turnData,
        title: 'Custom No Show Title',
        message: 'Custom no show message',
        confirmButtonText: 'Custom No Show Button',
        confirmButtonColor: 'secondary',
      });

      const confirmDialog = actor.getSnapshot().context.confirmDialog;
      expect(confirmDialog.open).toBe(true);
      expect(confirmDialog.action).toBe('no_show_turn');
      expect(confirmDialog.turnId).toBe('turn-222');
      expect(confirmDialog.turnData).toEqual(turnData);
      expect(confirmDialog.title).toBe('Custom No Show Title');
      expect(confirmDialog.message).toBe('Custom no show message');
      expect(confirmDialog.confirmButtonText).toBe('Custom No Show Button');
      expect(confirmDialog.confirmButtonColor).toBe('secondary');
    });
  });

  describe('OPEN_NOTIFICATION_MODAL Event', () => {
    it('should open notification modal', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'OPEN_NOTIFICATION_MODAL' });

      expect(actor.getSnapshot().context.notificationModal.open).toBe(true);
    });
  });

  describe('CLOSE_NOTIFICATION_MODAL Event', () => {
    it('should close notification modal', () => {
      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      actor.send({ type: 'OPEN_NOTIFICATION_MODAL' });
      expect(actor.getSnapshot().context.notificationModal.open).toBe(true);

      actor.send({ type: 'CLOSE_NOTIFICATION_MODAL' });
      expect(actor.getSnapshot().context.notificationModal.open).toBe(false);
    });
  });

  describe('OPEN_RATING_MODAL Event', () => {
    it('should open rating modal and always load subcategories', () => {
      // Mock auth snapshot
      mockOrchestrator.getSnapshot.mockReturnValue({
        context: {
          authResponse: undefined
        }
      });

      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turn = { id: 'turn-123', patientName: 'John Doe' };
      actor.send({
        type: 'OPEN_RATING_MODAL',
        turn,
      });

      const ratingModal = actor.getSnapshot().context.ratingModal;
      expect(ratingModal.open).toBe(true);
      expect(ratingModal.turn).toEqual(turn);

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'LOAD_RATING_SUBCATEGORIES',
        role: 'PATIENT'
      });
    });

    it('should load subcategories with user role', () => {
      // Mock auth snapshot with DOCTOR role
      mockOrchestrator.getSnapshot.mockReturnValue({
        context: {
          authResponse: { role: 'DOCTOR' }
        }
      });

      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turn = { id: 'turn-456', patientName: 'Jane Smith' };
      actor.send({
        type: 'OPEN_RATING_MODAL',
        turn,
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'LOAD_RATING_SUBCATEGORIES',
        role: 'DOCTOR'
      });
    });
  });

  describe('CLOSE_RATING_MODAL Event', () => {
    it('should close rating modal and reset turn', () => {
      mockOrchestrator.getSnapshot.mockReturnValue({
        context: {
          ratingSubcategories: []
        }
      });

      actor = createActor(uiMachine, { input: { navigate: vi.fn() } });
      actor.start();

      const turn = { id: 'turn-123', patientName: 'John Doe' };
      actor.send({
        type: 'OPEN_RATING_MODAL',
        turn,
      });

      expect(actor.getSnapshot().context.ratingModal.open).toBe(true);
      expect(actor.getSnapshot().context.ratingModal.turn).toEqual(turn);

      actor.send({ type: 'CLOSE_RATING_MODAL' });

      const ratingModal = actor.getSnapshot().context.ratingModal;
      expect(ratingModal.open).toBe(false);
      // Turn data should still be present after close (during animation)
      expect(ratingModal.turn).toEqual(turn);
      
      // After clear event, turn should be null
      actor.send({ type: 'CLEAR_RATING_MODAL' });
      const clearedModal = actor.getSnapshot().context.ratingModal;
      expect(clearedModal.turn).toBe(null);
    });
  });
})
})
