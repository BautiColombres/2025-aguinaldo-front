import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActor } from 'xstate';
import dayjs from '../utils/dayjs.config';

// Mock dependencies BEFORE importing the machine
vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    sendToMachine: vi.fn(),
    getSnapshot: vi.fn(),
    registerMachine: vi.fn(),
  }
}));

vi.mock('../service/turn-service.service', () => ({
  TurnService: {
    getAvailableDates: vi.fn(),
    getAvailableTurns: vi.fn(),
    createTurn: vi.fn(),
    getDoctorAvailability: vi.fn(),
    createModifyRequest: vi.fn(),
  }
}));

vi.mock('../service/turn-modify-service.service', () => ({
  TurnModifyService: {
    createModifyRequest: vi.fn(),
  }
}));

vi.mock('../utils/MachineUtils/turnMachineUtils', () => ({
  createTurn: vi.fn(),
  cancelTurn: vi.fn(),
  createModifyTurnRequest: vi.fn(),
  loadTurnDetails: vi.fn(),
  loadDoctorAvailability: vi.fn(),
  loadAvailableSlots: vi.fn(),
}));

import { turnMachine, TURN_MACHINE_EVENT_TYPES } from './turnMachine';
import { orchestrator } from '#/core/Orchestrator';
import { TurnService } from '../service/turn-service.service';
import { TurnModifyService } from '../service/turn-modify-service.service';
import { createTurn, cancelTurn } from '../utils/MachineUtils/turnMachineUtils';
import type { Doctor, TurnResponse } from '../models/Turn';

describe('turnMachine', () => {
  let actor: any;
  let mockOrchestrator: any;
  let mockTurnService: any;
  let mockTurnModifyService: any;
  let mockTurnUtils: any;

  const mockDoctor: Doctor = {
    id: 'doctor-1',
    name: 'Dr. John',
    surname: 'Smith',
    email: 'doctor@example.com',
    medicalLicense: 'ML12345',
    specialty: 'cardiology',
    slotDurationMin: 30,
    score: 4.5,
   
  };

  const mockTurn: TurnResponse = {
    id: 'turn-1',
    doctorId: 'doctor-1',
    doctorName: 'Dr. John Smith',
    doctorSpecialty: 'Cardiology',
    patientId: 'patient-1',
    patientName: 'Jane Doe',
    scheduledAt: '2025-10-15T10:00:00Z',
    status: 'RESERVED',
  };

  const mockAvailableDates = ['2025-10-15', '2025-10-16', '2025-10-17'];
  const mockAvailableSlots = ['2025-10-15T09:00:00Z', '2025-10-15T10:00:00Z', '2025-10-15T11:00:00Z'];

  beforeEach(() => {
    // Get mocked modules
    mockOrchestrator = vi.mocked(orchestrator);
    mockTurnService = vi.mocked(TurnService);
    mockTurnModifyService = vi.mocked(TurnModifyService);
    mockTurnUtils = vi.mocked({ createTurn, cancelTurn });

    // Reset mocks
    vi.clearAllMocks();

    mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

    // Setup default orchestrator mock
    mockOrchestrator.getSnapshot.mockReturnValue({
      context: {
        doctors: [mockDoctor],
        availableTurns: mockAvailableSlots,
        myTurns: [mockTurn],
        accessToken: 'token-123',
        userId: 'patient-1',
      }
    });
  });

  afterEach(() => {
    if (actor) {
      actor.stop();
    }
  });

  const waitForAvailabilitySync = async () => {
    await vi.waitFor(() => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.isLoadingDoctors).toBe(false);
      expect(snapshot.value.dataManagement).toBe('idle');
    });
  };

  describe('Initial State', () => {
    it('should start with parallel regions in their initial states', () => {
      actor = createActor(turnMachine);
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        takeTurn: 'step1',
        showTurns: 'idle',
        modifyTurn: 'idle',
        dataManagement: 'idle',
      });
    });

    it('should initialize with empty context', () => {
      actor = createActor(turnMachine);
      actor.start();

      const context = actor.getSnapshot().context;
      expect(context.doctors).toEqual([]);
      expect(context.availableTurns).toEqual([]);
      expect(context.myTurns).toEqual([]);
      expect(context.takeTurn.professionSelected).toBe('');
      expect(context.takeTurn.doctorId).toBe('');
      expect(context.showTurns.dateSelected).toBeNull();
      expect(context.modifyTurn?.turnId).toBeNull();
    });
  });

  describe('takeTurn Region - Step Navigation', () => {
    it('should transition from step1 to step2 on NEXT event', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      actor = createActor(turnMachine);
      actor.start();

      // Set doctor ID first
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value.takeTurn).toBe('step2');
      });
    });

    it('should load available dates when entering step2', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      // Mock accessToken in context
      actor.send({ type: 'DATA_LOADED' });

      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.availableDates).toEqual(mockAvailableDates);
        expect(snapshot.context.isLoadingAvailableDates).toBe(false);
      });
    });

    it('should handle error loading available dates', async () => {
      mockTurnService.getAvailableDates.mockRejectedValue(new Error('Failed to load dates'));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.error).toBe('Failed to load available dates');
        expect(snapshot.context.isLoadingAvailableDates).toBe(false);
      });
    });

    it('should go back from step2 to step1 on BACK event', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.takeTurn).toBe('step2');
      });

      actor.send({ type: 'BACK' });

      expect(actor.getSnapshot().value.takeTurn).toBe('step1');
    });

    it('should reset takeTurn context on RESET_TAKE_TURN event', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'professionSelected'],
        value: 'Cardiology',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      actor.send({ type: 'RESET_TAKE_TURN' });

      const takeTurn = actor.getSnapshot().context.takeTurn;
      expect(takeTurn.professionSelected).toBe('');
      expect(takeTurn.doctorId).toBe('');
      expect(takeTurn.dateSelected).toBeNull();
      expect(actor.getSnapshot().value.takeTurn).toBe('step1');
    });
  });

  describe('showTurns Region', () => {
    it('should start in idle state', () => {
      actor = createActor(turnMachine);
      actor.start();

      expect(actor.getSnapshot().value.showTurns).toBe('idle');
    });

    it('should reset showTurns context on RESET_SHOW_TURNS event', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['showTurns', 'dateSelected'],
        value: dayjs('2025-10-15'),
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['showTurns', 'statusFilter'],
        value: 'RESERVED',
      });

      actor.send({ type: 'RESET_SHOW_TURNS' });

      const showTurns = actor.getSnapshot().context.showTurns;
      expect(showTurns.dateSelected).toBeNull();
      expect(showTurns.statusFilter).toBe('');
    });
  });

  describe('UPDATE_FORM Event (Global)', () => {
    it('should update takeTurn nested field', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'professionSelected'],
        value: 'Cardiology',
      });

      expect(actor.getSnapshot().context.takeTurn.professionSelected).toBe('Cardiology');
    });

    it('should update multiple nested fields independently', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'profesionalSelected'],
        value: 'Dr. Smith',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'motive'],
        value: 'Annual checkup',
      });

      const takeTurn = actor.getSnapshot().context.takeTurn;
      expect(takeTurn.profesionalSelected).toBe('Dr. Smith');
      expect(takeTurn.doctorId).toBe('doctor-1');
      expect(takeTurn.motive).toBe('Annual checkup');
    });

    it('should update showTurns fields', () => {
      actor = createActor(turnMachine);
      actor.start();

      const testDate = dayjs('2025-10-15');
      actor.send({
        type: 'UPDATE_FORM',
        path: ['showTurns', 'dateSelected'],
        value: testDate,
      });

      expect(actor.getSnapshot().context.showTurns.dateSelected).toEqual(testDate);
    });

    it('should update modifyTurn fields', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'motive'],
        value: 'Need to reschedule',
      });

      expect(actor.getSnapshot().context.modifyTurn?.motive).toBe('Need to reschedule');
    });
  });

  describe('dataManagement Region - DATA_LOADED Event', () => {
    it('should load data from orchestrator on DATA_LOADED event', async () => {
      mockOrchestrator.getSnapshot.mockReturnValueOnce({
        context: {
          doctors: [mockDoctor],
          availableTurns: mockAvailableSlots,
          myTurns: [mockTurn],
          accessToken: 'token-123',
        }
      });

      mockOrchestrator.getSnapshot.mockReturnValueOnce({
        context: {
          authResponse: {
            id: 'patient-1',
          }
        }
      });

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      await waitForAvailabilitySync();

      const context = actor.getSnapshot().context;
      expect(context.doctors).toEqual([expect.objectContaining({ id: mockDoctor.id })]);
      expect(context.allDoctors).toEqual([expect.objectContaining({ id: mockDoctor.id })]);
      expect(context.availableTurns).toEqual([]);
      expect(context.myTurns).toEqual([mockTurn]);
      expect(context.accessToken).toBe('token-123');
    });

    it('should generate specialties from doctors', async () => {
      mockOrchestrator.getSnapshot.mockReturnValueOnce({
        context: {
          doctors: [
            { ...mockDoctor, specialty: 'cardiology' },
            { ...mockDoctor, id: 'doctor-2', specialty: 'dermatology' },
            { ...mockDoctor, id: 'doctor-3', specialty: 'cardiology' }, // duplicate
          ],
          availableTurns: [],
          myTurns: [],
          accessToken: 'token-123',
        }
      });

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      await waitForAvailabilitySync();

      const specialties = actor.getSnapshot().context.specialties;
      expect(specialties).toHaveLength(2);
      expect(specialties).toContainEqual({ value: 'cardiology', label: 'Cardiology' });
      expect(specialties).toContainEqual({ value: 'dermatology', label: 'Dermatology' });
    });

    it('should handle missing data gracefully', async () => {
      mockOrchestrator.getSnapshot.mockReturnValue({
        context: {}
      });

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      await waitForAvailabilitySync();

      const context = actor.getSnapshot().context;
      expect(context.doctors).toEqual([]);
      expect(context.availableTurns).toEqual([]);
      expect(context.myTurns).toEqual([]);
    });

    it('should filter out doctors without availability and hide their specialties', async () => {
      const unavailableDoctor: Doctor = {
        ...mockDoctor,
        id: 'doctor-2',
        specialty: 'dermatology',
        medicalLicense: 'ML67890',
      };

      mockOrchestrator.getSnapshot
        .mockReturnValueOnce({
          context: {
            doctors: [mockDoctor, unavailableDoctor],
            availableTurns: mockAvailableSlots,
            myTurns: [mockTurn],
            accessToken: 'token-123',
            userId: 'patient-1',
          },
        })
        .mockReturnValueOnce({
          context: {
            authResponse: {
              id: 'patient-1',
            },
          },
        });

      mockTurnService.getAvailableDates.mockImplementation(async (doctorId: string) => {
        if (doctorId === unavailableDoctor.id) {
          return [];
        }
        return mockAvailableDates;
      });

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      await waitForAvailabilitySync();

      const context = actor.getSnapshot().context;
      expect(context.allDoctors).toHaveLength(2);
      expect(context.doctors).toEqual([expect.objectContaining({ id: mockDoctor.id })]);
      expect(context.specialties).toEqual([{ value: 'cardiology', label: 'Cardiology' }]);
      expect(context.doctorAvailability).toMatchObject({
        [mockDoctor.id]: true,
        [unavailableDoctor.id]: false,
      });
      expect(context.availableTurns).toEqual([]);
    });

    it('should clear doctors and specialties when no availability exists', async () => {
      mockOrchestrator.getSnapshot
        .mockReturnValueOnce({
          context: {
            doctors: [mockDoctor],
            availableTurns: mockAvailableSlots,
            myTurns: [mockTurn],
            accessToken: 'token-123',
          },
        })
        .mockReturnValueOnce({
          context: {
            authResponse: {
              id: 'patient-1',
            },
          },
        });

      mockTurnService.getAvailableDates.mockResolvedValue([]);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      await waitForAvailabilitySync();

      const context = actor.getSnapshot().context;
      expect(context.doctors).toEqual([]);
      expect(context.specialties).toEqual([]);
      expect(context.doctorAvailability).toMatchObject({ [mockDoctor.id]: false });
      expect(context.availableTurns).toEqual([]);
    });
  });

  describe('dataManagement Region - CREATE_TURN', () => {
    it('should transition to creatingTurn state on CREATE_TURN event', async () => {
      mockTurnUtils.createTurn.mockResolvedValue(mockTurn);

      actor = createActor(turnMachine);
      actor.start();

      // Setup context
      actor.send({ type: 'DATA_LOADED' });
      await waitForAvailabilitySync();
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'scheduledAt'],
        value: '2025-10-15T10:00:00Z',
      });

      actor.send({ type: 'CREATE_TURN' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.dataManagement).toBe('creatingTurn');
      });
    });

    it('should create turn successfully and notify user', async () => {
      mockTurnUtils.createTurn.mockResolvedValue(mockTurn);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      await waitForAvailabilitySync();
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'scheduledAt'],
        value: '2025-10-15T10:00:00Z',
      });

      actor.send({ type: 'CREATE_TURN' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value.dataManagement).toBe('idle');
        expect(snapshot.context.isCreatingTurn).toBe(false);
        expect(snapshot.context.error).toBeNull();
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'LOAD_MY_TURNS',
      });
      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: 'Turno creado exitosamente',
        severity: 'success',
      });
    });

    it('should handle turn creation error', async () => {
      const errorMessage = 'Failed to create turn';
      mockTurnUtils.createTurn.mockRejectedValue(new Error(errorMessage));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      await waitForAvailabilitySync();
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'scheduledAt'],
        value: '2025-10-15T10:00:00Z',
      });

      actor.send({ type: 'CREATE_TURN' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value.dataManagement).toBe('idle');
        expect(snapshot.context.error).toBe(errorMessage);
        expect(snapshot.context.isCreatingTurn).toBe(false);
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: errorMessage,
        severity: 'error',
      });
    });

    it('should set isCreatingTurn flag during creation', async () => {
      mockTurnUtils.createTurn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockTurn), 100)));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      await waitForAvailabilitySync();
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'scheduledAt'],
        value: '2025-10-15T10:00:00Z',
      });

      actor.send({ type: 'CREATE_TURN' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.dataManagement).toBe('creatingTurn');
      });

      expect(actor.getSnapshot().context.isCreatingTurn).toBe(true);
    });
  });

  describe('CANCEL_TURN Event (Global)', () => {
    it('should transition to cancellingTurn state on CANCEL_TURN event', async () => {
      mockTurnUtils.cancelTurn.mockResolvedValue(undefined);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'CANCEL_TURN', turnId: 'turn-1' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.dataManagement).toBe('cancellingTurn');
      });
    });

    it('should cancel turn successfully and show success message', async () => {
      mockTurnUtils.cancelTurn.mockResolvedValue(undefined);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'CANCEL_TURN', turnId: 'turn-1' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value.dataManagement).toBe('idle');
        expect(snapshot.context.isCancellingTurn).toBe(false);
        expect(snapshot.context.cancelSuccess).toBe('Turno cancelado exitosamente');
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('data', {
        type: 'LOAD_MY_TURNS',
      });
      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: 'Turno cancelado exitosamente',
        severity: 'success',
      });
    });

    it('should handle turn cancellation error', async () => {
      const errorMessage = 'Failed to cancel turn';
      mockTurnUtils.cancelTurn.mockRejectedValue(new Error(errorMessage));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'CANCEL_TURN', turnId: 'turn-1' });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.value.dataManagement).toBe('idle');
        expect(snapshot.context.error).toBe(errorMessage);
        expect(snapshot.context.isCancellingTurn).toBe(false);
      });

      expect(mockOrchestrator.sendToMachine).toHaveBeenCalledWith('ui', {
        type: 'OPEN_SNACKBAR',
        message: errorMessage,
        severity: 'error',
      });
    });

    it('should set cancellingTurnId during cancellation', async () => {
      mockTurnUtils.cancelTurn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 100)));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'CANCEL_TURN', turnId: 'turn-1' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.dataManagement).toBe('cancellingTurn');
      });

      expect(actor.getSnapshot().context.cancellingTurnId).toBe('turn-1');
      expect(actor.getSnapshot().context.isCancellingTurn).toBe(true);
    });
  });

  describe('CLEAR_CANCEL_SUCCESS Event (Global)', () => {
    it('should clear cancelSuccess message', async () => {
      mockTurnUtils.cancelTurn.mockResolvedValue(undefined);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'CANCEL_TURN', turnId: 'turn-1' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.cancelSuccess).toBe('Turno cancelado exitosamente');
      });

      actor.send({ type: 'CLEAR_CANCEL_SUCCESS' });

      expect(actor.getSnapshot().context.cancelSuccess).toBeNull();
    });
  });

  describe('modifyTurn Region - NAVIGATE Event', () => {
    it('should initialize modifyTurn when navigating to modify-turn page', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      // Load data first
      actor.send({ type: 'DATA_LOADED' });

      actor.send({
        type: 'NAVIGATE',
        to: '/patient/modify-turn?turnId=turn-1',
      });

      const modifyTurn = actor.getSnapshot().context.modifyTurn;
      expect(modifyTurn?.turnId).toBe('turn-1');
      expect(modifyTurn?.currentTurn).toEqual(mockTurn);

      // Restore original location
      (window as any).location = originalLocation;
    });

    it('should reset modifyTurn when navigating away', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'motive'],
        value: 'Test reason',
      });

      actor.send({ type: 'NAVIGATE', to: '/patient/view-turns' });

      const modifyTurn = actor.getSnapshot().context.modifyTurn;
      expect(modifyTurn?.turnId).toBeNull();
      expect(modifyTurn?.currentTurn).toBeNull();
      expect(modifyTurn?.motive).toBe('');
    });
  });

  describe('modifyTurn Region - State Transitions', () => {
    it('should transition to modifying state when turnId is set', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({
        type: 'NAVIGATE',
        to: '/patient/modify-turn?turnId=turn-1',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.modifyTurn).toBe('modifying');
      });

      (window as any).location = originalLocation;
    });

    it('should load available dates when entering modifying state', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({
        type: 'NAVIGATE',
        to: '/patient/modify-turn?turnId=turn-1',
      });

      await vi.waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.modifyTurn?.availableDates).toEqual(mockAvailableDates);
        expect(snapshot.context.isLoadingAvailableDates).toBe(false);
      });

      (window as any).location = originalLocation;
    });
  });

  describe('modifyTurn Region - SUBMIT_MODIFY_REQUEST', () => {
    it('should transition to submittingModifyRequest state', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);
      mockTurnModifyService.createModifyRequest.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));

      // Mock orchestrator.getSnapshot to return accessToken for the input function
      mockOrchestrator.getSnapshot.mockImplementation((machineId: string) => {
        if (machineId === 'data') {
          return {
            context: {
              doctors: [mockDoctor],
              availableTurns: mockAvailableSlots,
              myTurns: [mockTurn],
              accessToken: 'token-123',
              userId: 'patient-1',
            }
          };
        }
        return {
          context: {
            authResponse: { id: 'patient-1' }
          }
        };
      });

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({
        type: 'NAVIGATE',
        to: '/patient/modify-turn?turnId=turn-1',
      });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.modifyTurn).toBe('modifying');
      });

      // Set new date and time
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedDate'],
        value: dayjs('2025-10-16'),
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedTime'],
        value: '2025-10-16T14:00:00Z',
      });

      actor.send({ type: 'SUBMIT_MODIFY_REQUEST' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.modifyTurn).toBe('submittingModifyRequest');
      });

      (window as any).location = originalLocation;
    });

    // FBUG-H2: validation must happen inside the fromPromise body, not in the
    // actor `input` builder. A null selectedTime must NOT throw synchronously and
    // crash the parent actor; it must surface a handled error and keep the actor alive.
    it('should not crash the actor when selectedTime is null (validation in actor body)', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      mockOrchestrator.getSnapshot.mockImplementation((machineId: string) => {
        if (machineId === 'data') {
          return {
            context: {
              doctors: [mockDoctor],
              availableTurns: mockAvailableSlots,
              myTurns: [mockTurn],
              accessToken: 'token-123',
              userId: 'patient-1',
            }
          };
        }
        return { context: { authResponse: { id: 'patient-1' } } };
      });

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'NAVIGATE', to: '/patient/modify-turn?turnId=turn-1' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.modifyTurn).toBe('modifying');
      });

      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedDate'],
        value: dayjs('2025-10-16'),
      });
      // No time selected.
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedTime'],
        value: null,
      });

      actor.send({ type: 'SUBMIT_MODIFY_REQUEST' });

      // The actor must NOT crash: it surfaces a handled error and stays alive
      // (status 'active'), rather than the parent faulting from a throw in `input`.
      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.modifyError).toBeTruthy();
      });
      expect(actor.getSnapshot().status).toBe('active');
      expect(mockTurnModifyService.createModifyRequest).not.toHaveBeenCalled();

      // Still responsive to further events (proves the actor is alive).
      expect(() => actor.send({ type: 'DATA_LOADED' })).not.toThrow();
      expect(actor.getSnapshot().status).toBe('active');

      (window as any).location = originalLocation;
    });

    // FBUG-H2: selectedTime format must be validated before split('T'); an invalid
    // format must reject gracefully (onError) and never reach the service.
    it('should reject gracefully when selectedTime has an invalid format', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      mockOrchestrator.getSnapshot.mockImplementation((machineId: string) => {
        if (machineId === 'data') {
          return {
            context: {
              doctors: [mockDoctor],
              availableTurns: mockAvailableSlots,
              myTurns: [mockTurn],
              accessToken: 'token-123',
              userId: 'patient-1',
            }
          };
        }
        return { context: { authResponse: { id: 'patient-1' } } };
      });

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost/patient/modify-turn?turnId=turn-1',
      } as any;

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({ type: 'NAVIGATE', to: '/patient/modify-turn?turnId=turn-1' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.modifyTurn).toBe('modifying');
      });

      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedDate'],
        value: dayjs('2025-10-16'),
      });
      // Invalid time format: no 'T' separator to split on.
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'selectedTime'],
        value: 'not-a-valid-time',
      });

      actor.send({ type: 'SUBMIT_MODIFY_REQUEST' });

      // Invalid format rejects gracefully via onError; the service is never called
      // and the actor stays alive.
      await vi.waitFor(() => {
        expect(actor.getSnapshot().context.modifyError).toBeTruthy();
      });
      expect(actor.getSnapshot().status).toBe('active');
      expect(mockTurnModifyService.createModifyRequest).not.toHaveBeenCalled();

      (window as any).location = originalLocation;
    });
  });

  describe('Parallel State Behavior', () => {
    it('should allow independent transitions in different regions', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      // Update takeTurn region
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });

      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.takeTurn).toBe('step2');
      });

      // Update showTurns region independently
      actor.send({
        type: 'UPDATE_FORM',
        path: ['showTurns', 'statusFilter'],
        value: 'RESERVED',
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value.takeTurn).toBe('step2');
      expect(snapshot.value.showTurns).toBe('idle');
      expect(snapshot.context.showTurns.statusFilter).toBe('RESERVED');
    });

    it('should handle global events affecting all regions', () => {
      actor = createActor(turnMachine);
      actor.start();

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'motive'],
        value: 'Reason 1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['showTurns', 'statusFilter'],
        value: 'COMPLETED',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['modifyTurn', 'motive'],
        value: 'Reason 2',
      });

      const context = actor.getSnapshot().context;
      expect(context.takeTurn.motive).toBe('Reason 1');
      expect(context.showTurns.statusFilter).toBe('COMPLETED');
      expect(context.modifyTurn?.motive).toBe('Reason 2');
    });
  });

  describe('Context Management', () => {
    it('should maintain context integrity across state transitions', async () => {
      mockTurnService.getAvailableDates.mockResolvedValue(mockAvailableDates);
      mockTurnUtils.createTurn.mockResolvedValue(mockTurn);

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });

      const originalAccessToken = actor.getSnapshot().context.accessToken;

      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.takeTurn).toBe('step2');
      });

      expect(actor.getSnapshot().context.accessToken).toBe(originalAccessToken);
    });

    it('should preserve form data during async operations', async () => {
      mockTurnService.getAvailableDates.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockAvailableDates), 100)));

      actor = createActor(turnMachine);
      actor.start();

      actor.send({ type: 'DATA_LOADED' });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'doctorId'],
        value: 'doctor-1',
      });
      actor.send({
        type: 'UPDATE_FORM',
        path: ['takeTurn', 'motive'],
        value: 'Important reason',
      });

      actor.send({ type: 'NEXT' });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value.takeTurn).toBe('step2');
      });

      expect(actor.getSnapshot().context.takeTurn.motive).toBe('Important reason');
      expect(actor.getSnapshot().context.takeTurn.doctorId).toBe('doctor-1');
    });
  });
});

describe('turnMachine - FBUG-H3: dead RESERVE_TURN flow removed', () => {
  it('does not declare RESERVE_TURN in the routed event types', () => {
    expect(TURN_MACHINE_EVENT_TYPES).not.toContain('RESERVE_TURN');
  });

  it('does not expose the dead reserve context fields', () => {
    const actor = createActor(turnMachine);
    actor.start();
    const context = actor.getSnapshot().context as unknown as Record<string, unknown>;
    expect('reserveError' in context).toBe(false);
    expect('isReservingTurn' in context).toBe(false);
    actor.stop();
  });

  it('ignores a RESERVE_TURN event without transitioning or faulting the actor', () => {
    const actor = createActor(turnMachine);
    actor.start();
    const before = actor.getSnapshot().value;

    // Casting through unknown: RESERVE_TURN is no longer part of the event union.
    actor.send({ type: 'RESERVE_TURN', turnId: 'turn-1' } as unknown as never);

    const snapshot = actor.getSnapshot();
    expect(snapshot.status).toBe('active');
    expect(snapshot.value).toEqual(before);
    actor.stop();
  });
});
