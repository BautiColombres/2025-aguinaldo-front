import { createMachine, assign, fromPromise } from 'xstate';
import { MedicalHistory, CreateMedicalHistoryRequest, UpdateMedicalHistoryContentRequest, TagFrequency } from '../models/MedicalHistory';
import { MedicalHistoryService } from '../service/medical-history-service.service';
import { orchestrator } from '../core/Orchestrator';
import { UI_MACHINE_ID } from './uiMachine';
import { formatDate } from '../utils/dateTimeUtils';
// FBUG-003 — the backend now returns a JSON body for 403 ("Access denied"), so the
// error kind (not the raw message text) decides the copy.
import { API_ERROR_MESSAGES, classifyApiError } from '../../config/api';

export const MEDICAL_HISTORY_MACHINE_ID = "medicalHistory"; 
export const MEDICAL_HISTORY_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  "LOAD_PATIENT_MEDICAL_HISTORY",
  "ADD_HISTORY_ENTRY_FOR_TURN",
  "UPDATE_HISTORY_ENTRY",
  "DELETE_HISTORY_ENTRY",
  "SELECT_HISTORY",
  "CLEAR_SELECTION",
  "SET_NEW_CONTENT",
  "SET_EDIT_CONTENT",
  "CLEAR_ERROR",
]; 
interface MedicalHistoryMachineContext {
  medicalHistories: MedicalHistory[];
  currentPatientId: string | null;
  currentTurnId: string | null;
  currentTurnInfo: {
    patientName?: string;
    scheduledAt?: string;
    status?: string;
  } | null;
  patientTurns: any[]; // Store patient's turns for turn information display
  frequentTags: TagFrequency[];
  error: string | null;
  isLoading: boolean;
  selectedHistory: MedicalHistory | null;
  newHistoryContent: string;
  newHistoryTags: string[];
  editingContent: string;
  editingTags: string[];
  accessToken: string | null;
  doctorId: string | null;
}

export type MedicalHistoryMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'CLEAR_ACCESS_TOKEN' }
  | { type: 'LOAD_PATIENT_MEDICAL_HISTORY'; patientId: string; accessToken: string; doctorId?: string }
  | { type: 'ADD_HISTORY_ENTRY_FOR_TURN'; turnId: string; content: string; tags?: string[]; accessToken: string; doctorId: string; turnInfo?: { patientName?: string; scheduledAt?: string; status?: string } }
  | { type: 'UPDATE_HISTORY_ENTRY'; historyId: string; content: string; tags?: string[]; accessToken: string; doctorId: string }
  | { type: 'DELETE_HISTORY_ENTRY'; historyId: string; accessToken: string; doctorId: string }
  | { type: 'SELECT_HISTORY'; history: MedicalHistory }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_NEW_CONTENT'; content: string }
    | { type: 'SET_EDIT_CONTENT'; content: string }
  | { type: 'CLEAR_ERROR' };

export const medicalHistoryMachine = createMachine({
  id: 'medicalHistory',
  types: {} as {
    context: MedicalHistoryMachineContext;
    events: MedicalHistoryMachineEvent;
  },
  initial: 'idle',
  context: {
    medicalHistories: [],
    currentPatientId: null,
    currentTurnId: null,
    currentTurnInfo: null,
    patientTurns: [],
    frequentTags: [],
    error: null,
    isLoading: false,
    selectedHistory: null,
    newHistoryContent: '',
    newHistoryTags: [],
    editingContent: '',
    editingTags: [],
    accessToken: null,
    doctorId: null,
  } as MedicalHistoryMachineContext,
  on: {
    // FBUG-003 — the interceptor silently refreshed the access token (401 -> refresh
    // -> retry). Adopt it IN PLACE: pure assign, no target, no refetch. Do NOT reuse
    // SET_AUTH here — that means "a session just started" and re-bootstraps machines.
    TOKEN_REFRESHED: {
      actions: assign({
        accessToken: ({ event }) => event.accessToken,
      }),
    },
    // FSEC — logout / session expiry must wipe the in-memory credentials from EVERY
    // machine. A bearer left behind in context is a live, usable credential (the
    // retry-401 path can even leave a freshly minted one here).
    CLEAR_ACCESS_TOKEN: {
      actions: assign({
        accessToken: null,
        doctorId: null,
      }),
    },
  },
  states: {
    idle: {
      on: {
        LOAD_PATIENT_MEDICAL_HISTORY: {
          target: 'loadingMedicalHistory',
          guard: ({ context, event }) => {
            // Only load if it's a different patient or if we don't have data yet
            return context.currentPatientId !== event.patientId || context.medicalHistories.length === 0;
          },
          actions: assign({
            currentPatientId: ({ event }) => event.patientId,
            accessToken: ({ event }) => event.accessToken,
            doctorId: ({ event }) => 'doctorId' in event ? (event as any).doctorId : null,
            error: () => null,
          }),
        },
        ADD_HISTORY_ENTRY_FOR_TURN: {
          target: 'addingMedicalHistoryForTurn',
          actions: assign({
            currentTurnId: ({ event }) => event.turnId,
            currentTurnInfo: ({ event }) => event.turnInfo || null,
            newHistoryContent: ({ event }) => event.content,
            newHistoryTags: ({ event }) => event.tags ?? [],
            accessToken: ({ event }) => event.accessToken,
            doctorId: ({ event }) => event.doctorId,
            error: () => null,
          }),
        },
        UPDATE_HISTORY_ENTRY: {
          target: 'updatingMedicalHistory',
          actions: assign({
            editingContent: ({ event }) => event.content,
            editingTags: ({ event }) => event.tags ?? [],
            accessToken: ({ event }) => event.accessToken,
            doctorId: ({ event }) => event.doctorId,
            selectedHistory: ({ context, event }) => 
              context.medicalHistories.find(h => h.id === event.historyId) || null,
            error: () => null,
          }),
        },
        DELETE_HISTORY_ENTRY: {
          target: 'deletingMedicalHistory',
          actions: assign({
            accessToken: ({ event }) => event.accessToken,
            doctorId: ({ event }) => event.doctorId,
            selectedHistory: ({ context, event }) => 
              context.medicalHistories.find(h => h.id === event.historyId) || null,
            error: () => null,
          }),
        },
        SELECT_HISTORY: {
          actions: assign({
            selectedHistory: ({ event }) => event.history,
            newHistoryContent: ({ event }) => event.history.content || '',
          }),
        },
        CLEAR_SELECTION: {
          actions: assign({
            selectedHistory: () => null,
            editingContent: () => '',
          }),
        },
        SET_NEW_CONTENT: {
          actions: assign({
            newHistoryContent: ({ event }) => event.content,
          }),
        },
        SET_EDIT_CONTENT: {
          actions: assign({
            editingContent: ({ event }) => event.content,
          }),
        },
        CLEAR_ERROR: {
          actions: assign({
            error: () => null,
          }),
        },
      },
    },
    loadingMedicalHistory: {
      entry: assign({ isLoading: () => true }),
      exit: assign({ isLoading: () => false }),
      invoke: {
        src: 'loadPatientMedicalHistory',
        input: ({ context }) => ({ 
          patientId: context.currentPatientId!,
          accessToken: context.accessToken!,
          doctorId: context.doctorId || undefined,
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            medicalHistories: ({ event }) => event.output.medicalHistories,
            patientTurns: ({ event }) => event.output.patientTurns,
            frequentTags: ({ event }) => event.output.frequentTags,
          }),
        },
        onError: {
          target: 'idle',
          actions: assign({
            error: ({ event }) => `Error loading medical history: ${event.error}`,
          }),
        },
      },
    },
    // Deprecated state removed
    addingMedicalHistoryForTurn: {
      entry: assign({ isLoading: () => true }),
      exit: assign({ isLoading: () => false }),
      invoke: {
        src: 'addMedicalHistoryEntryForTurn',
        input: ({ context }) => ({
          turnId: context.currentTurnId!,
          content: context.newHistoryContent,
          tags: context.newHistoryTags,
          accessToken: context.accessToken!,
          doctorId: context.doctorId!,
        }),
        onDone: [
          {
            target: 'reloadingAfterMutation',
            guard: 'hasCurrentPatient',
            actions: ['applyAddSuccess', 'notifyAddSuccess'],
          },
          {
            target: 'idle',
            actions: ['applyAddSuccess', 'notifyAddSuccess'],
          },
        ],
        onError: {
          target: 'idle',
          actions: [
            assign({
              error: ({ event }) => `Error al agregar historia médica al turno: ${event.error}`,
              currentTurnId: () => null,
              currentTurnInfo: () => null,
              selectedHistory: () => null,
              editingContent: () => '',
            }),
            ({ context, event }) => {
              const error = event.error as Error | { message?: string } | unknown;
              const turnInfo = context.currentTurnInfo;
              let message = turnInfo 
                ? `Error al agregar historia médica para ${turnInfo.patientName}`
                : 'Error al agregar historia médica';
                
              const errorMessage = error instanceof Error 
                ? error.message 
                : typeof error === 'object' && error !== null && 'message' in error 
                  ? String(error.message) 
                  : String(error);
              
              if (errorMessage) {
                if (errorMessage.includes('404')) {
                  message += ': Turno no encontrado';
                } else if (classifyApiError(error).kind === 'forbidden') {
                  message += `: ${API_ERROR_MESSAGES.forbidden}`;
                } else if (classifyApiError(error).kind === 'unauthorized') {
                  message += ': Tu sesión expiró. Por favor, iniciá sesión nuevamente.';
                } else {
                  message += ': ' + errorMessage;
                }
              }
              
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: 'OPEN_SNACKBAR',
                message,
                severity: 'error'
              });
            }
          ],
        },
      },
    },
    updatingMedicalHistory: {
      entry: assign({ isLoading: () => true }),
      exit: assign({ isLoading: () => false }),
      invoke: {
        src: 'updateMedicalHistoryEntry',
        input: ({ context }) => ({
          historyId: context.selectedHistory!.id,
          content: context.editingContent,
          tags: context.editingTags,
          accessToken: context.accessToken!,
          doctorId: context.doctorId!,
        }),
        onDone: [
          {
            target: 'reloadingAfterMutation',
            guard: 'hasCurrentPatient',
            actions: ['applyUpdateSuccess', 'notifyUpdateSuccess'],
          },
          {
            target: 'idle',
            actions: ['applyUpdateSuccess', 'notifyUpdateSuccess'],
          },
        ],
        onError: {
          target: 'idle',
          actions: [
            assign({
              error: ({ event }) => `Error actualizando la historia médica: ${event.error}`,
              selectedHistory: () => null,
              editingContent: () => '',
              editingTags: () => [],
            }),
            () => {
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: 'OPEN_SNACKBAR',
                message: 'Error al actualizar historia médica',
                severity: 'error'
              });
            }
          ],
        },
      },
    },
    deletingMedicalHistory: {
      entry: assign({ isLoading: () => true }),
      exit: assign({ isLoading: () => false }),
      invoke: {
        src: 'deleteMedicalHistoryEntry',
        input: ({ context }) => ({ 
          historyId: context.selectedHistory!.id,
          accessToken: context.accessToken!,
          doctorId: context.doctorId!,
        }),
        onDone: [
          {
            target: 'reloadingAfterMutation',
            guard: 'hasCurrentPatient',
            actions: ['applyDeleteSuccess', 'notifyDeleteSuccess'],
          },
          {
            target: 'idle',
            actions: ['applyDeleteSuccess', 'notifyDeleteSuccess'],
          },
        ],
        onError: {
          target: 'idle',
          actions: [
            assign({
              error: ({ event }) => `Error al eliminar historia médica: ${event.error}`,
            }),
            () => {
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: 'OPEN_SNACKBAR',
                message: 'Error al eliminar historia médica',
                severity: 'error'
              });
            }
          ],
        },
      },
    },
    reloadingAfterMutation: {
      entry: assign({ isLoading: () => true }),
      exit: assign({ isLoading: () => false }),
      invoke: {
        src: 'loadPatientMedicalHistory',
        input: ({ context }) => ({
          patientId: context.currentPatientId!,
          accessToken: context.accessToken!,
          doctorId: context.doctorId || undefined,
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            medicalHistories: ({ event }) => event.output.medicalHistories,
            patientTurns: ({ event }) => event.output.patientTurns,
            frequentTags: ({ event }) => event.output.frequentTags,
          }),
        },
        onError: {
          target: 'idle',
        },
      },
    },
  },
}, {
  guards: {
    hasCurrentPatient: ({ context }) => context.currentPatientId != null,
  },
  actions: {
    applyAddSuccess: assign({
      medicalHistories: ({ context, event }: any) => [...context.medicalHistories, event.output],
      newHistoryContent: () => '',
      newHistoryTags: () => [],
      currentTurnId: () => null,
      currentTurnInfo: () => null,
      selectedHistory: () => null,
      editingContent: () => '',
    }),
    notifyAddSuccess: ({ context }: any) => {
      const turnInfo = context.currentTurnInfo;
      const message = turnInfo
        ? `Historia médica agregada exitosamente para ${turnInfo.patientName} - ${formatDate(turnInfo.scheduledAt || '')}`
        : 'Historia médica agregada exitosamente';

      orchestrator.sendToMachine(UI_MACHINE_ID, {
        type: 'OPEN_SNACKBAR',
        message,
        severity: 'success'
      });

      try {
        orchestrator.sendToMachine('turn', {
          type: 'RETRY_DOCTOR_TURNS'
        });

        orchestrator.sendToMachine('data', {
          type: 'RETRY_DOCTOR_PATIENTS'
        });

        if (context.currentPatientId) {
          orchestrator.sendToMachine('doctor', {
            type: 'RETRY_DOCTOR_PATIENTS'
          });
        }
      } catch (error) {
        // Silent error handling for data refresh
      }
    },
    applyUpdateSuccess: assign({
      medicalHistories: ({ context, event }: any) =>
        context.medicalHistories.map((h: MedicalHistory) =>
          h.id === event.output.id ? event.output : h
        ),
      selectedHistory: () => null,
      editingContent: () => '',
      editingTags: () => [],
    }),
    notifyUpdateSuccess: () => {
      orchestrator.sendToMachine(UI_MACHINE_ID, {
        type: 'OPEN_SNACKBAR',
        message: 'Historia médica actualizada exitosamente',
        severity: 'success'
      });
    },
    applyDeleteSuccess: assign({
      medicalHistories: ({ context }: any) =>
        context.medicalHistories.filter((h: MedicalHistory) => h.id !== context.selectedHistory!.id),
      selectedHistory: () => null,
    }),
    notifyDeleteSuccess: () => {
      orchestrator.sendToMachine(UI_MACHINE_ID, {
        type: 'OPEN_SNACKBAR',
        message: 'Historia médica eliminada exitosamente',
        severity: 'success'
      });
    },
  },
  actors: {
    loadPatientMedicalHistory: fromPromise(async ({ input }: { input: { patientId: string; accessToken: string; doctorId?: string } }) => {
      try {
        // If doctorId is provided, use the doctor-specific endpoint to retrieve only histories the doctor can access.
        let medicalHistories;
        let frequentTags: TagFrequency[] = [];
        if (input.doctorId) {
          medicalHistories = await MedicalHistoryService.getPatientMedicalHistoryByDoctor(input.accessToken, input.doctorId, input.patientId);
          try {
            frequentTags = await MedicalHistoryService.getPatientFrequentTags(input.accessToken, input.doctorId, input.patientId);
          } catch (tagsError) {
            frequentTags = [];
          }
        } else {
          // Fallback to the general patient endpoint (e.g., when a patient is viewing their own history)
          medicalHistories = await MedicalHistoryService.getPatientMedicalHistory(input.accessToken, input.patientId);
        }

        return {
          medicalHistories,
          patientTurns: [],
          frequentTags,
        };
      } catch (error) {
        return {
          medicalHistories: [],
          patientTurns: [],
          frequentTags: [],
        };
      }
    }),
    addMedicalHistoryEntryForTurn: fromPromise(async ({ input }: { input: { turnId: string; content: string; tags?: string[]; accessToken: string; doctorId: string } }) => {
      try {
        const request: CreateMedicalHistoryRequest = {
          turnId: input.turnId,
          content: input.content,
          ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
        };

        const result = await MedicalHistoryService.addMedicalHistory(input.accessToken, input.doctorId, request);
        return result;
      } catch (error) {
        throw error;
      }
    }),
    updateMedicalHistoryEntry: fromPromise(async ({ input }: { input: { historyId: string; content: string; tags?: string[]; accessToken: string; doctorId: string } }) => {
      const request: UpdateMedicalHistoryContentRequest = {
        content: input.content,
        tags: input.tags ?? [],
      };
      return await MedicalHistoryService.updateMedicalHistory(input.accessToken, input.doctorId, input.historyId, request);
    }),
    deleteMedicalHistoryEntry: fromPromise(async ({ input }: { input: { historyId: string; accessToken: string; doctorId: string } }) => {
      await MedicalHistoryService.deleteMedicalHistory(input.accessToken, input.doctorId, input.historyId);
      return input.historyId;
    }),
  },
});