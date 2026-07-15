import { createMachine, assign, fromPromise } from "xstate";
import { NotificationService, NotificationResponse } from '../service/notification-service.service';

export const NOTIFICATION_MACHINE_ID = "notification";
export const NOTIFICATION_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  "SET_AUTH",
  "CLEAR_ACCESS_TOKEN",
  "LOAD_NOTIFICATIONS",
  "DELETE_NOTIFICATION",
  "DELETE_ALL_NOTIFICATIONS",
  "ALL_NOTIFICATIONS_SHOWN",
];

export interface NotificationMachineContext {
  notifications: NotificationResponse[];
  currentNotificationIndex: number;
  isLoading: boolean;
  isDeletingNotification: boolean;
  isDeletingAllNotifications: boolean;
  error: string | null;
  accessToken: string | null;
}

export type NotificationMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: "SET_AUTH"; accessToken: string }
  | { type: "CLEAR_ACCESS_TOKEN" }
  | { type: "LOAD_NOTIFICATIONS"; accessToken?: string }
  | { type: "DELETE_NOTIFICATION"; notificationId: string }
  | { type: "DELETE_ALL_NOTIFICATIONS" }
  | { type: "ALL_NOTIFICATIONS_SHOWN" };

export const notificationMachine = createMachine({
  id: "notificationMachine",
  initial: "idle",
  context: {
    notifications: [],
    currentNotificationIndex: 0,
    isLoading: false,
    isDeletingNotification: false,
    isDeletingAllNotifications: false,
    error: null,
    accessToken: null,
  } as NotificationMachineContext,
  types: {
    context: {} as NotificationMachineContext,
    events: {} as NotificationMachineEvent,
  },
  states: {
    idle: {
      on: {
        SET_AUTH: {
          actions: assign({
            accessToken: ({ event }) => event.accessToken,
          }),
        },
        LOAD_NOTIFICATIONS: {
          target: "loadingNotifications",
          actions: assign({
            accessToken: ({ event, context }) => event.accessToken || context.accessToken,
          }),
        },
      },
    },
    loadingNotifications: {
      entry: assign({ isLoading: true, error: null }),
      invoke: {
        src: fromPromise(async ({ input }) => {
          return await NotificationService.getNotifications(input.accessToken);
        }),
        input: ({ context }) => ({
          accessToken: context.accessToken,
        }),
        onDone: {
          target: "ready",
          actions: assign({
            notifications: ({ event }) => event.output,
            currentNotificationIndex: 0,
            isLoading: false,
            // Clear deletion flags when reload is complete
            isDeletingNotification: false,
            isDeletingAllNotifications: false,
          }),
        },
        onError: {
          target: "idle",
          actions: assign({
            isLoading: false,
            // Clear deletion flags even on error
            isDeletingNotification: false,
            isDeletingAllNotifications: false,
            error: ({ event }) => (event.error as Error)?.message || "Failed to load notifications",
          }),
        },
      },
    },
    ready: {
      on: {
        LOAD_NOTIFICATIONS: {
          target: "loadingNotifications",
          actions: assign({
            accessToken: ({ event, context }) => event.accessToken || context.accessToken,
          }),
        },
        DELETE_NOTIFICATION: {
          target: "deletingNotification",
          guard: ({ context }) => !context.isDeletingNotification && !context.isDeletingAllNotifications,
        },
        DELETE_ALL_NOTIFICATIONS: {
          target: "deletingAllNotifications",
          guard: ({ context }) => !context.isDeletingNotification && !context.isDeletingAllNotifications,
        },
      },
    },
    deletingNotification: {
      entry: assign({ 
        isDeletingNotification: true, 
        error: null 
      }),
      invoke: {
        src: fromPromise(async ({ input }) => {
          await NotificationService.deleteNotification(input.notificationId, input.accessToken);
          return input.notificationId; // Return the ID so we can use it in onDone
        }),
        input: ({ context, event }) => ({
          notificationId: (event as any).notificationId,
          accessToken: context.accessToken,
        }),
        onDone: {
          target: "loadingNotifications",
          actions: assign({
            // Keep isDeletingNotification true during reload
            // It will be set to false when notifications are successfully reloaded
          }),
        },
        onError: {
          target: "ready",
          actions: assign({
            isDeletingNotification: false,
            error: ({ event }) => (event.error as Error)?.message || "Failed to delete notification",
          }),
        },
      },
    },
    deletingAllNotifications: {
      entry: assign({ 
        isDeletingAllNotifications: true, 
        error: null 
      }),
      invoke: {
        src: fromPromise(async ({ input }) => {
          // Delete all notifications sequentially
          const promises = input.notificationIds.map((id: string) => 
            NotificationService.deleteNotification(id, input.accessToken)
          );
          await Promise.all(promises);
        }),
        input: ({ context }) => ({
          notificationIds: context.notifications.map(n => n.id),
          accessToken: context.accessToken,
        }),
        onDone: {
          target: "loadingNotifications",
          actions: assign({
            // Keep isDeletingAllNotifications true during reload
            // It will be set to false when notifications are successfully reloaded
          }),
        },
        onError: {
          target: "ready",
          actions: assign({
            isDeletingAllNotifications: false,
            error: ({ event }) => (event.error as Error)?.message || "Failed to delete notifications",
          }),
        },
      },
    },
  },
  on: {
    // FBUG-003 — the interceptor silently refreshed the access token (401 -> refresh
    // -> retry). Adopt it IN PLACE: pure assign, no target, no refetch. Do NOT reuse
    // SET_AUTH here — that means "a session just started" and re-bootstraps machines.
    TOKEN_REFRESHED: {
      actions: assign({
        accessToken: ({ event }) => event.accessToken,
      }),
    },
    SET_AUTH: {
      actions: assign({
        accessToken: ({ event }) => event.accessToken,
      }),
    },
    CLEAR_ACCESS_TOKEN: {
      actions: assign({
        notifications: [],
        currentNotificationIndex: 0,
        isLoading: false,
        isDeletingNotification: false,
        isDeletingAllNotifications: false,
        error: null,
        accessToken: null,
      }),
    },
    ALL_NOTIFICATIONS_SHOWN: {
      actions: assign({
        notifications: [],
        currentNotificationIndex: 0,
      }),
    },
  },
});