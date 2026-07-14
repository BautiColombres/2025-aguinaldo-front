import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';

// Mock all utilities and dependencies BEFORE importing the machine
vi.mock('../utils/MachineUtils/dataMachineUtils', () => ({
  loadDoctors: vi.fn(),
  loadPendingDoctors: vi.fn(),
  loadAdminStats: vi.fn(),
  loadAvailableTurns: vi.fn(),
  loadMyTurns: vi.fn(),
  loadDoctorModifyRequests: vi.fn(),
  loadMyModifyRequests: vi.fn(),
  loadSpecialties: vi.fn(),
}));

vi.mock('../utils/MachineUtils/doctorMachineUtils', () => ({
  loadDoctorPatients: vi.fn(),
  loadDoctorAvailability: vi.fn(),
}));

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    sendToMachine: vi.fn(),
    registerMachine: vi.fn(),
  }
}));

import { dataMachine, DataMachineDefaultContext } from './dataMachine';
import { API_ERROR_MESSAGES } from '../../config/api';
import { orchestrator } from '#/core/Orchestrator';
import * as dataMachineUtils from '../utils/MachineUtils/dataMachineUtils';
import * as doctorMachineUtils from '../utils/MachineUtils/doctorMachineUtils';

describe('dataMachine', () => {
  let actor: any;
  let mockOrchestrator: any;
  let mockLoadDoctors: any;
  let mockLoadPendingDoctors: any;
  let mockLoadAdminStats: any;
  let mockLoadAvailableTurns: any;
  let mockLoadMyTurns: any;
  let mockLoadDoctorPatients: any;
  let mockLoadDoctorAvailability: any;
  let mockLoadDoctorModifyRequests: any;
  let mockLoadMyModifyRequests: any;
  let mockLoadSpecialties: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Get mocked modules
    mockOrchestrator = vi.mocked(orchestrator);
    mockLoadDoctors = vi.mocked(dataMachineUtils.loadDoctors);
    mockLoadPendingDoctors = vi.mocked(dataMachineUtils.loadPendingDoctors);
    mockLoadAdminStats = vi.mocked(dataMachineUtils.loadAdminStats);
    mockLoadAvailableTurns = vi.mocked(dataMachineUtils.loadAvailableTurns);
    mockLoadMyTurns = vi.mocked(dataMachineUtils.loadMyTurns);
    mockLoadDoctorPatients = vi.mocked(doctorMachineUtils.loadDoctorPatients);
    mockLoadDoctorAvailability = vi.mocked(doctorMachineUtils.loadDoctorAvailability);
    mockLoadDoctorModifyRequests = vi.mocked(dataMachineUtils.loadDoctorModifyRequests);
    mockLoadMyModifyRequests = vi.mocked(dataMachineUtils.loadMyModifyRequests);
    mockLoadSpecialties = vi.mocked(dataMachineUtils.loadSpecialties);

    // Reset all mocks
    vi.clearAllMocks();

    // Default successful responses
    mockLoadDoctors.mockResolvedValue([
      { id: '1', name: 'Dr. Smith', specialty: 'Cardiology' }
    ]);
    mockLoadPendingDoctors.mockResolvedValue([
      { id: '2', name: 'Dr. Jones', specialty: 'Neurology' }
    ]);
    mockLoadAdminStats.mockResolvedValue({ patients: 100, doctors: 50, pending: 5 });
    mockLoadAvailableTurns.mockResolvedValue(['09:00', '10:00', '11:00']);
    mockLoadMyTurns.mockResolvedValue([
      { id: '1', date: '2024-01-15', time: '10:00' }
    ]);
    mockLoadDoctorPatients.mockResolvedValue([
      { id: '1', name: 'John Doe' }
    ]);
    mockLoadDoctorAvailability.mockResolvedValue([
      { day: 'Monday', slots: ['09:00', '10:00'] }
    ]);
    mockLoadDoctorModifyRequests.mockResolvedValue([
      { id: '1', status: 'PENDING' }
    ]);
    mockLoadMyModifyRequests.mockResolvedValue([
      { id: '1', status: 'PENDING' }
    ]);
    mockLoadSpecialties.mockResolvedValue(['Cardiology', 'Neurology']);
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in idle state with default context', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context).toEqual(DataMachineDefaultContext);
    });

    it('should have null authentication values initially', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      const context = actor.getSnapshot().context;
      expect(context.accessToken).toBeNull();
      expect(context.userRole).toBeNull();
      expect(context.userId).toBeNull();
      expect(context.doctorId).toBeNull();
    });

    it('should have empty data arrays initially', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      const context = actor.getSnapshot().context;
      expect(context.doctors).toEqual([]);
      expect(context.pendingDoctors).toEqual([]);
      expect(context.availableTurns).toEqual([]);
      expect(context.myTurns).toEqual([]);
      expect(context.doctorPatients).toEqual([]);
      expect(context.doctorAvailability).toEqual([]);
      expect(context.doctorModifyRequests).toEqual([]);
    });

    it('should have all loading flags set to false initially', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      const loading = actor.getSnapshot().context.loading;
      expect(Object.values(loading).every(value => value === false)).toBe(true);
    });

    it('should have all error values set to null initially', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      const errors = actor.getSnapshot().context.errors;
      expect(Object.values(errors).every(value => value === null)).toBe(true);
    });
  });

  describe('SET_AUTH Event', () => {
    it('should set auth context and transition to loadingInitialData for PATIENT', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'user1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        const context = actor.getSnapshot().context;
        expect(context.accessToken).toBe('token123');
        expect(context.userId).toBe('user1');
        expect(context.userRole).toBe('PATIENT');
        expect(context.doctorId).toBeNull();
      });
    });

    it('should set doctorId for DOCTOR role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        const context = actor.getSnapshot().context;
        expect(context.userRole).toBe('DOCTOR');
        expect(context.doctorId).toBe('doctor1');
      });
    });

    it('should set doctorId to null for ADMIN role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        const context = actor.getSnapshot().context;
        expect(context.userRole).toBe('ADMIN');
        expect(context.doctorId).toBeNull();
      });
    });

    it('should load initial data for PATIENT role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalled();
      expect(mockLoadMyTurns).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).not.toHaveBeenCalled();
      expect(mockLoadAdminStats).not.toHaveBeenCalled();
    });

    it('should load initial data for ADMIN role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'admintoken',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).toHaveBeenCalled();
      expect(mockLoadAdminStats).toHaveBeenCalled();
      expect(mockLoadMyTurns).not.toHaveBeenCalled();
    });

    it('should load initial data for DOCTOR role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'doctortoken',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).not.toHaveBeenCalled();
      expect(mockLoadMyTurns).toHaveBeenCalled();
      expect(mockLoadDoctorAvailability).toHaveBeenCalled();
      expect(mockLoadDoctorModifyRequests).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).not.toHaveBeenCalled();
    });
  });

  describe('CLEAR_ACCESS_TOKEN Event', () => {
    it('should clear all auth and data from idle state', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({ type: 'CLEAR_ACCESS_TOKEN' });

      const context = actor.getSnapshot().context;
      expect(context.accessToken).toBeNull();
      expect(context.userRole).toBeNull();
      expect(context.userId).toBeNull();
      expect(context.doctorId).toBeNull();
      expect(context.doctors).toEqual([]);
      expect(context.pendingDoctors).toEqual([]);
      expect(context.myTurns).toEqual([]);
    });

    it('should clear all auth and data from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'user1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      actor.send({ type: 'CLEAR_ACCESS_TOKEN' });

      expect(actor.getSnapshot().value).toBe('idle');
      const context = actor.getSnapshot().context;
      expect(context.accessToken).toBeNull();
      expect(context.doctors).toEqual([]);
    });
  });

  describe('RELOAD_DOCTORS Event', () => {
    it('should reload doctors from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'user1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockResolvedValue([
        { id: '2', name: 'Dr. New', specialty: 'Pediatrics' }
      ]);

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalledTimes(1);
      expect(actor.getSnapshot().context.doctors).toEqual([
        { id: '2', name: 'Dr. New', specialty: 'Pediatrics' }
      ]);
    });

    it('should not reload doctors from idle state without accessToken', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({ type: 'RELOAD_DOCTORS' });

      expect(actor.getSnapshot().value).toBe('idle');
      expect(mockLoadDoctors).not.toHaveBeenCalled();
    });

    it('should handle reload doctors error', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'user1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockRejectedValue(new Error('Network error'));

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.errors.doctors).toBe('Network error');
      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: 'Network error',
        severity: 'error'
      });
    });
  });

  describe('RELOAD_PENDING_DOCTORS Event', () => {
    it('should reload pending doctors from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadPendingDoctors.mockClear();
      mockLoadPendingDoctors.mockResolvedValue([
        { id: '3', name: 'Dr. Pending', specialty: 'Surgery' }
      ]);

      actor.send({ type: 'RELOAD_PENDING_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadPendingDoctors).toHaveBeenCalledTimes(1);
      expect(actor.getSnapshot().context.pendingDoctors).toEqual([
        { id: '3', name: 'Dr. Pending', specialty: 'Surgery' }
      ]);
    });

    it('should handle reload pending doctors error with 401', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadPendingDoctors.mockClear();
      mockLoadPendingDoctors.mockRejectedValue(new Error('401 Unauthorized'));

      actor.send({ type: 'RELOAD_PENDING_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('auth', {
        type: 'LOGOUT'
      });
    });
  });

  describe('RELOAD_ADMIN_STATS Event', () => {
    it('should reload admin stats from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadAdminStats.mockClear();
      mockLoadAdminStats.mockResolvedValue({ patients: 200, doctors: 100, pending: 10 });

      actor.send({ type: 'RELOAD_ADMIN_STATS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadAdminStats).toHaveBeenCalledTimes(1);
      expect(actor.getSnapshot().context.adminStats).toEqual({
        patients: 200,
        doctors: 100,
        pending: 10
      });
    });
  });

  describe('RELOAD_ALL Event', () => {
    it('should reload all data for ADMIN role', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadPendingDoctors.mockClear();
      mockLoadAdminStats.mockClear();

      // Mock sendToMachine to send events to the same actor
      mockOrchestrator.sendToMachine.mockImplementation((machineId: string, event: any) => {
        if (machineId === 'data') {
          setTimeout(() => actor.send(event), 0);
        }
      });

      actor.send({ type: 'RELOAD_ALL' });

      await vi.waitFor(() => {
        expect(mockLoadDoctors).toHaveBeenCalled();
      }, { timeout: 2000 });

      await vi.waitFor(() => {
        expect(mockLoadPendingDoctors).toHaveBeenCalled();
      }, { timeout: 2000 });

      await vi.waitFor(() => {
        expect(mockLoadAdminStats).toHaveBeenCalled();
      }, { timeout: 2000 });

      expect(actor.getSnapshot().value).toBe('ready');
    });

    it('should not reload from idle state without accessToken', () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({ type: 'RELOAD_ALL' });

      expect(actor.getSnapshot().value).toBe('idle');
    });
  });

  describe('LOAD_AVAILABLE_TURNS Event', () => {
    it('should load available turns with doctorId and date', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadAvailableTurns.mockClear();
      mockLoadAvailableTurns.mockResolvedValue(['14:00', '15:00', '16:00']);

      actor.send({
        type: 'LOAD_AVAILABLE_TURNS',
        doctorId: 'doctor1',
        date: '2024-01-20',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadAvailableTurns).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor1',
        date: '2024-01-20',
      });
      expect(actor.getSnapshot().context.availableTurns).toEqual(['14:00', '15:00', '16:00']);
    });

    it('should not load available turns without doctorId', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadAvailableTurns.mockClear();

      actor.send({
        type: 'LOAD_AVAILABLE_TURNS',
        doctorId: '',
        date: '2024-01-20',
      });

      expect(actor.getSnapshot().value).toBe('ready');
      expect(mockLoadAvailableTurns).not.toHaveBeenCalled();
    });

    it('should handle load available turns error', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadAvailableTurns.mockClear();
      mockLoadAvailableTurns.mockRejectedValue(new Error('No disponible'));

      actor.send({
        type: 'LOAD_AVAILABLE_TURNS',
        doctorId: 'doctor1',
        date: '2024-01-20',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.errors.availableTurns).toBe('No disponible');
    });
  });

  describe('LOAD_MY_TURNS Event', () => {
    it('should load my turns from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadMyTurns.mockClear();
      mockLoadMyTurns.mockResolvedValue([
        { id: '2', date: '2024-01-20', time: '14:00' }
      ]);

      actor.send({ type: 'LOAD_MY_TURNS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadMyTurns).toHaveBeenCalledWith({
        accessToken: 'token123',
        status: undefined,
      });
      expect(actor.getSnapshot().context.myTurns).toEqual([
        { id: '2', date: '2024-01-20', time: '14:00' }
      ]);
    });

    it('should load my turns with status filter', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadMyTurns.mockClear();

      actor.send({
        type: 'LOAD_MY_TURNS',
        status: 'CONFIRMED',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadMyTurns).toHaveBeenCalledWith({
        accessToken: 'token123',
        status: 'CONFIRMED',
      });
    });
  });

  describe('LOAD_DOCTOR_PATIENTS Event', () => {
    it('should load doctor patients from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorPatients.mockClear();
      mockLoadDoctorPatients.mockResolvedValue([
        { id: '2', name: 'Jane Doe' }
      ]);

      actor.send({ type: 'LOAD_DOCTOR_PATIENTS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctorPatients).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor1',
      });
      expect(actor.getSnapshot().context.doctorPatients).toEqual([
        { id: '2', name: 'Jane Doe' }
      ]);
    });

    it('should send DATA_LOADED event after loading doctor patients', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorPatients.mockClear();
      mockOrchestrator.send.mockClear();

      actor.send({ type: 'LOAD_DOCTOR_PATIENTS' });

      await vi.waitFor(() => {
        expect(mockOrchestrator.send).toHaveBeenNthCalledWith(2, {
          type: 'DATA_LOADED',
          doctorAvailability: expect.any(Array),
          userBadgeProgress: expect.any(Array),
          userBadges: expect.any(Array)
        });
      }, { timeout: 2000 });
    });
  });

  describe('LOAD_DOCTOR_AVAILABILITY Event', () => {
    it('should load doctor availability from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorAvailability.mockClear();
      mockLoadDoctorAvailability.mockResolvedValue([
        { day: 'Tuesday', slots: ['13:00', '14:00'] }
      ]);

      actor.send({ type: 'LOAD_DOCTOR_AVAILABILITY' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctorAvailability).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor1',
      });
      expect(actor.getSnapshot().context.doctorAvailability).toEqual([
        { day: 'Tuesday', slots: ['13:00', '14:00'] }
      ]);
    });

    it('should load doctor availability with provided doctorId', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorAvailability.mockClear();

      actor.send({
        type: 'LOAD_DOCTOR_AVAILABILITY',
        doctorId: 'doctor2',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctorAvailability).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor2',
      });
    });
  });

  describe('LOAD_DOCTOR_MODIFY_REQUESTS Event', () => {
    it('should load doctor modify requests from ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorModifyRequests.mockClear();
      mockLoadDoctorModifyRequests.mockResolvedValue([
        { id: '2', status: 'APPROVED' }
      ]);

      actor.send({ type: 'LOAD_DOCTOR_MODIFY_REQUESTS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctorModifyRequests).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor1',
      });
      expect(actor.getSnapshot().context.doctorModifyRequests).toEqual([
        { id: '2', status: 'APPROVED' }
      ]);
    });

    it('should load doctor modify requests with provided doctorId', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctorModifyRequests.mockClear();

      actor.send({
        type: 'LOAD_DOCTOR_MODIFY_REQUESTS',
        doctorId: 'doctor3',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctorModifyRequests).toHaveBeenCalledWith({
        accessToken: 'token123',
        doctorId: 'doctor3',
      });
    });
  });

  describe('Ready State Entry', () => {
    it('should send DATA_LOADED event when entering ready state', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      mockOrchestrator.send.mockClear();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      vi.runAllTimers();

      expect(mockOrchestrator.send).toHaveBeenCalledWith({
        type: 'DATA_LOADED',
        doctorAvailability: expect.anything(),
        userBadgeProgress: expect.any(Array),
        userBadges: expect.any(Array)
      });
    });

    it('should send LOAD_NOTIFICATIONS to notification machine', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      mockOrchestrator.sendToMachine.mockClear();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      vi.runAllTimers();

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('notification', {
        type: 'LOAD_NOTIFICATIONS',
      });
    });
  });

  describe('Loading States', () => {
    it('should set loading flags during loadingInitialData', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      // Delay the resolution to check loading state
      mockLoadDoctors.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('fetchingDoctors');
      });

      const loading = actor.getSnapshot().context.loading;
      expect(loading.doctors).toBe(true);

      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });
    });

    it('should set loading flag during fetchingDoctors', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('fetchingDoctors');
      });

      expect(actor.getSnapshot().context.loading.doctors).toBe(true);

      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.loading.doctors).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle error during initial data loading', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      mockLoadDoctors.mockRejectedValue(new Error('Server error'));

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.errors.doctors).toBe('Server error');
      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: 'Server error',
        severity: 'error'
      });
    });

    it('should logout on 401 error during data loading', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockRejectedValue(new Error('401 unauthorized'));

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('auth', {
          type: 'LOGOUT'
        });
      }, { timeout: 2000 });
    });

    it('should handle non-Error exceptions', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockRejectedValue('String error');

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.errors.doctors).toBe('Error al cargar doctores');
    });

    it('maps an AbortSignal.timeout rejection to the shared timeout message', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadDoctors.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.errors.doctors).toBe(API_ERROR_MESSAGES.timeout);
    });
  });

  describe('Context Persistence', () => {
    it('should preserve loaded data across state transitions', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      const initialDoctors = actor.getSnapshot().context.doctors;
      expect(initialDoctors.length).toBeGreaterThan(0);

      mockLoadMyTurns.mockClear();
      mockLoadMyTurns.mockResolvedValue([
        { id: '2', date: '2024-02-01', time: '09:00' }
      ]);

      actor.send({ type: 'LOAD_MY_TURNS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      // Doctors should still be preserved
      expect(actor.getSnapshot().context.doctors).toEqual(initialDoctors);
    });

    it('should update only relevant data when reloading specific resource', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      const initialPendingDoctors = actor.getSnapshot().context.pendingDoctors;

      mockLoadAdminStats.mockClear();
      mockLoadAdminStats.mockResolvedValue({ patients: 300, doctors: 150, pending: 15 });

      actor.send({ type: 'RELOAD_ADMIN_STATS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      // Admin stats should be updated
      expect(actor.getSnapshot().context.adminStats.patients).toBe(300);
      // Pending doctors should remain unchanged
      expect(actor.getSnapshot().context.pendingDoctors).toEqual(initialPendingDoctors);
    });
  });

  describe('Role-Based Data Loading', () => {
    it('should load only PATIENT-specific data', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalled();
      expect(mockLoadMyTurns).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).not.toHaveBeenCalled();
      expect(mockLoadAdminStats).not.toHaveBeenCalled();
      expect(mockLoadDoctorAvailability).not.toHaveBeenCalled();
    });

    it('should load only ADMIN-specific data', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).toHaveBeenCalled();
      expect(mockLoadAdminStats).toHaveBeenCalled();
      expect(mockLoadMyTurns).not.toHaveBeenCalled();
      expect(mockLoadDoctorAvailability).not.toHaveBeenCalled();
    });

    it('should load only DOCTOR-specific data', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'doctor1',
        userRole: 'DOCTOR',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).not.toHaveBeenCalled();
      expect(mockLoadMyTurns).toHaveBeenCalled();
      expect(mockLoadDoctorAvailability).toHaveBeenCalled();
      expect(mockLoadDoctorModifyRequests).toHaveBeenCalled();
      expect(mockLoadPendingDoctors).not.toHaveBeenCalled();
      expect(mockLoadAdminStats).not.toHaveBeenCalled();
    });
  });

  describe('Complex Workflows', () => {
    it('should handle authentication change from one user to another', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      // First authentication as PATIENT
      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token1',
        userId: 'patient1',
        userRole: 'PATIENT',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.userRole).toBe('PATIENT');

      // Second authentication as ADMIN
      mockLoadPendingDoctors.mockClear();
      mockLoadAdminStats.mockClear();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token2',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(actor.getSnapshot().context.userRole).toBe('ADMIN');
      expect(mockLoadPendingDoctors).toHaveBeenCalled();
      expect(mockLoadAdminStats).toHaveBeenCalled();
    });

    it('should handle multiple sequential reload operations', async () => {
      actor = createActor(dataMachine, {});
      actor.start();

      actor.send({
        type: 'SET_AUTH',
        accessToken: 'token123',
        userId: 'admin1',
        userRole: 'ADMIN',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      mockLoadDoctors.mockClear();
      mockLoadPendingDoctors.mockClear();
      mockLoadAdminStats.mockClear();

      actor.send({ type: 'RELOAD_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      actor.send({ type: 'RELOAD_PENDING_DOCTORS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      actor.send({ type: 'RELOAD_ADMIN_STATS' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe('ready');
      }, { timeout: 2000 });

      expect(mockLoadDoctors).toHaveBeenCalledTimes(1);
      expect(mockLoadPendingDoctors).toHaveBeenCalledTimes(2);
      expect(mockLoadAdminStats).toHaveBeenCalledTimes(3);
    });
  });
});