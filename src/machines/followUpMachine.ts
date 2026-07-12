import { createMachine, assign, fromPromise } from 'xstate';
import { FollowUpService } from '../service/follow-up-service.service';
import { orchestrator } from '../core/Orchestrator';
import { UI_MACHINE_ID } from './uiMachine';
import type { FollowUpReminder, FollowUpMonths } from '../models/FollowUpReminder';

export const FOLLOW_UP_MACHINE_ID = 'followUp';
export const FOLLOW_UP_MACHINE_EVENT_TYPES = [
  'CREATE_FOLLOWUP',
  'LOAD_DUE_FOLLOWUPS',
  'DISMISS_FOLLOWUP',
  'LOAD_PATIENT_FOLLOWUPS',
  'CLEAR_ERROR',
];

interface FollowUpMachineContext {
  dueReminders: FollowUpReminder[];
  patientReminders: FollowUpReminder[];
  isLoading: boolean;
  error: string | null;
  // transient inputs for the active invocation
  accessToken: string | null;
  doctorId: string | null;
  patientId: string | null;
  currentHistoryId: string | null;
  currentMonths: FollowUpMonths | null;
  currentReminderId: string | null;
}

export type FollowUpMachineEvent =
  | { type: 'CREATE_FOLLOWUP'; historyId: string; months: FollowUpMonths; accessToken: string; doctorId: string }
  | { type: 'LOAD_DUE_FOLLOWUPS'; doctorId: string; accessToken: string }
  | { type: 'DISMISS_FOLLOWUP'; reminderId: string; doctorId: string; accessToken: string }
  | { type: 'LOAD_PATIENT_FOLLOWUPS'; patientId: string; accessToken: string }
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
      patientReminders: [],
      isLoading: false,
      error: null,
      accessToken: null,
      doctorId: null,
      patientId: null,
      currentHistoryId: null,
      currentMonths: null,
      currentReminderId: null,
    } as FollowUpMachineContext,
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
                error: ({ event }) => {
                  const err = event.error as Error | { message?: string } | unknown;
                  return err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message?: string }).message)
                      : 'Error al crear el recordatorio de control';
                },
              }),
              ({ context }) => {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_SNACKBAR',
                  message: context.error || 'Error al crear el recordatorio de control',
                  severity: 'error',
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
    },
  },
);

export default followUpMachine;
