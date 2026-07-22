import { createMachine, assign, fromPromise } from 'xstate';
import { FollowUpService } from '../service/follow-up-service.service';
import { isConflictError } from '../../config/api';
import { orchestrator } from '../core/Orchestrator';
import { UI_MACHINE_ID } from './uiMachine';
import type { FollowUpReminder, FollowUpMonths, DueForFollowUp } from '../models/FollowUpReminder';

export const FOLLOW_UP_MACHINE_ID = 'followUp';

// FBUG-002 — the backend rejects a second active reminder for the same medical
// history with a 409. `FollowUpService.createReminder` tags that rejection with
// `status: 409` (see `ApiError`), so we can show this specific copy without
// depending on the backend's wording (which reached the UI blank/opaque).
export const DUPLICATE_FOLLOWUP_MESSAGE = 'Ya existe un recordatorio activo para esta consulta';
export const CREATE_FOLLOWUP_ERROR_MESSAGE = 'Error al crear el recordatorio de control';

const createErrorMessage = (error: unknown): string => {
  if (isConflictError(error)) {
    return DUPLICATE_FOLLOWUP_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message || CREATE_FOLLOWUP_ERROR_MESSAGE;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: string }).message) || CREATE_FOLLOWUP_ERROR_MESSAGE;
  }
  return CREATE_FOLLOWUP_ERROR_MESSAGE;
};

export const FOLLOW_UP_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  'CREATE_FOLLOWUP',
  'LOAD_DUE_FOLLOWUPS',
  'LOAD_DUE_FOR_FOLLOWUP',
  'DISMISS_FOLLOWUP',
  'LOAD_PATIENT_FOLLOWUPS',
  'LOAD_DOCTOR_PATIENT_FOLLOWUPS',
  'CLEAR_ERROR',
];

interface FollowUpMachineContext {
  dueReminders: FollowUpReminder[];
  dueForFollowUp: DueForFollowUp[];
  patientReminders: FollowUpReminder[];
  // Doctor-scoped, non-dismissed reminders the CURRENT doctor created for the
  // patient being viewed. Kept separate from `patientReminders` (patient-role) so
  // neither loader clobbers the other's list.
  doctorPatientReminders: FollowUpReminder[];
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  doctorId: string | null;
  patientId: string | null;
  currentHistoryId: string | null;
  currentMonths: FollowUpMonths | null;
  currentReminderId: string | null;
}

export type FollowUpMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'CLEAR_ACCESS_TOKEN' }
  | { type: 'CREATE_FOLLOWUP'; historyId: string; months: FollowUpMonths; accessToken: string; doctorId: string }
  | { type: 'LOAD_DUE_FOLLOWUPS'; doctorId: string; accessToken: string }
  | { type: 'LOAD_DUE_FOR_FOLLOWUP'; doctorId: string; accessToken: string }
  | { type: 'DISMISS_FOLLOWUP'; reminderId: string; doctorId: string; accessToken: string }
  | { type: 'LOAD_PATIENT_FOLLOWUPS'; patientId: string; accessToken: string }
  | { type: 'LOAD_DOCTOR_PATIENT_FOLLOWUPS'; doctorId: string; patientId: string; accessToken: string }
  | { type: 'CLEAR_ERROR' };

export const followUpMachine = createMachine(
  {
    id: 'followUp',
    types: {} as {
      context: FollowUpMachineContext;
      events: FollowUpMachineEvent;
    },
    initial: 'idle',
    context: {
      dueReminders: [],
      dueForFollowUp: [],
      patientReminders: [],
      doctorPatientReminders: [],
      isLoading: false,
      error: null,
      accessToken: null,
      doctorId: null,
      patientId: null,
      currentHistoryId: null,
      currentMonths: null,
      currentReminderId: null,
    } as FollowUpMachineContext,
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
          patientId: null,
        }),
      },
    },
    states: {
      idle: {
        on: {
          CREATE_FOLLOWUP: {
            target: 'creating',
            actions: assign({
              currentHistoryId: ({ event }) => event.historyId,
              currentMonths: ({ event }) => event.months,
              accessToken: ({ event }) => event.accessToken,
              doctorId: ({ event }) => event.doctorId,
              error: () => null,
            }),
          },
          LOAD_DUE_FOLLOWUPS: {
            target: 'loadingDue',
            actions: assign({
              doctorId: ({ event }) => event.doctorId,
              accessToken: ({ event }) => event.accessToken,
              error: () => null,
            }),
          },
          LOAD_DUE_FOR_FOLLOWUP: {
            target: 'loadingDueForFollowUp',
            actions: assign({
              doctorId: ({ event }) => event.doctorId,
              accessToken: ({ event }) => event.accessToken,
              error: () => null,
            }),
          },
          DISMISS_FOLLOWUP: {
            target: 'dismissing',
            actions: assign({
              currentReminderId: ({ event }) => event.reminderId,
              doctorId: ({ event }) => event.doctorId,
              accessToken: ({ event }) => event.accessToken,
              error: () => null,
            }),
          },
          LOAD_PATIENT_FOLLOWUPS: {
            target: 'loadingPatientReminders',
            actions: assign({
              patientId: ({ event }) => event.patientId,
              accessToken: ({ event }) => event.accessToken,
              error: () => null,
            }),
          },
          LOAD_DOCTOR_PATIENT_FOLLOWUPS: {
            target: 'loadingDoctorPatientReminders',
            actions: assign({
              doctorId: ({ event }) => event.doctorId,
              patientId: ({ event }) => event.patientId,
              accessToken: ({ event }) => event.accessToken,
              error: () => null,
            }),
          },
          CLEAR_ERROR: {
            actions: assign({ error: () => null }),
          },
        },
      },
      creating: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'createReminder',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            doctorId: context.doctorId!,
            historyId: context.currentHistoryId!,
            months: context.currentMonths!,
          }),
          onDone: {
            target: 'idle',
            actions: [
              () => {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_SNACKBAR',
                  message: 'Recordatorio de control creado exitosamente',
                  severity: 'success',
                });
              },
            ],
          },
          onError: {
            target: 'idle',
            actions: [
              assign({
                error: ({ event }) => createErrorMessage(event.error),
              }),
              ({ context, event }) => {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_SNACKBAR',
                  message: context.error || CREATE_FOLLOWUP_ERROR_MESSAGE,
                  severity: isConflictError(event.error) ? 'warning' : 'error',
                });
              },
            ],
          },
        },
      },
      loadingDue: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'getDueReminders',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            doctorId: context.doctorId!,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              dueReminders: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'idle',
            actions: assign({
              error: ({ event }) => `Error al cargar recordatorios: ${event.error}`,
            }),
          },
        },
      },
      loadingDueForFollowUp: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'getDueForFollowUp',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            doctorId: context.doctorId!,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              dueForFollowUp: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'idle',
            actions: assign({
              error: ({ event }) => `Error al cargar pacientes con seguimiento pendiente: ${event.error}`,
            }),
          },
        },
      },
      dismissing: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'dismissReminder',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            doctorId: context.doctorId!,
            reminderId: context.currentReminderId!,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              dueReminders: ({ context }) =>
                context.dueReminders.filter((r) => r.id !== context.currentReminderId),
            }),
          },
          onError: {
            target: 'idle',
            actions: [
              assign({
                error: ({ event }) => `Error al descartar recordatorio: ${event.error}`,
              }),
              () => {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_SNACKBAR',
                  message: 'Error al descartar el recordatorio',
                  severity: 'error',
                });
              },
            ],
          },
        },
      },
      loadingPatientReminders: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'getPatientReminders',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            patientId: context.patientId!,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              patientReminders: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'idle',
            actions: assign({
              error: ({ event }) => `Error al cargar recordatorios: ${event.error}`,
            }),
          },
        },
      },
      loadingDoctorPatientReminders: {
        entry: assign({ isLoading: () => true }),
        exit: assign({ isLoading: () => false }),
        invoke: {
          src: 'getDoctorPatientReminders',
          input: ({ context }) => ({
            accessToken: context.accessToken!,
            doctorId: context.doctorId!,
            patientId: context.patientId!,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              doctorPatientReminders: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'idle',
            actions: assign({
              error: ({ event }) => `Error al cargar recordatorios: ${event.error}`,
            }),
          },
        },
      },
    },
  },
  {
    actors: {
      createReminder: fromPromise(
        async ({ input }: { input: { accessToken: string; doctorId: string; historyId: string; months: FollowUpMonths } }) =>
          FollowUpService.createReminder(input.accessToken, input.doctorId, input.historyId, input.months),
      ),
      getDueReminders: fromPromise(
        async ({ input }: { input: { accessToken: string; doctorId: string } }) =>
          FollowUpService.getDueReminders(input.accessToken, input.doctorId),
      ),
      getDueForFollowUp: fromPromise(
        async ({ input }: { input: { accessToken: string; doctorId: string } }) =>
          FollowUpService.getDueForFollowUp(input.accessToken, input.doctorId),
      ),
      dismissReminder: fromPromise(
        async ({ input }: { input: { accessToken: string; doctorId: string; reminderId: string } }) => {
          await FollowUpService.dismissReminder(input.accessToken, input.doctorId, input.reminderId);
          return input.reminderId;
        },
      ),
      getPatientReminders: fromPromise(
        async ({ input }: { input: { accessToken: string; patientId: string } }) =>
          FollowUpService.getPatientReminders(input.accessToken, input.patientId),
      ),
      getDoctorPatientReminders: fromPromise(
        async ({ input }: { input: { accessToken: string; doctorId: string; patientId: string } }) =>
          FollowUpService.getDoctorPatientReminders(input.accessToken, input.doctorId, input.patientId),
      ),
    },
  },
);

export default followUpMachine;
