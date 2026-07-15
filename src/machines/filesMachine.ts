import { createMachine, assign, fromPromise } from "xstate";
import { StorageService } from '../service/storage-service.service';
import { orchestrator } from "#/core/Orchestrator";
import { DATA_MACHINE_ID } from "./dataMachine";
import { UI_MACHINE_ID } from "./uiMachine";

export const FILES_MACHINE_ID = "files";
export const FILES_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  "SET_AUTH",
  "UPLOAD_TURN_FILE",
  "DELETE_TURN_FILE", 
  "CLEAR_UPLOAD_SUCCESS",
  "CLEAR_DELETE_SUCCESS",
  "CLEAR_ERROR",
];

export interface FilesMachineContext {
  accessToken: string | null;
  
  isUploadingFile: boolean;
  uploadingFileTurnId: string | null;
  uploadError: string | null;
  uploadSuccess: string | null;

  isDeletingFile: boolean;
  deletingFileTurnId: string | null;
  deleteError: string | null;
  deleteSuccess: string | null;
}

export type FilesMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'CLEAR_ACCESS_TOKEN' }
  | { type: "SET_AUTH"; accessToken: string }
  | { type: "UPLOAD_TURN_FILE"; turnId: string; file: File }
  | { type: "DELETE_TURN_FILE"; turnId: string }
  | { type: "CLEAR_UPLOAD_SUCCESS" }
  | { type: "CLEAR_DELETE_SUCCESS" }
  | { type: "CLEAR_ERROR" };

export const FilesMachineDefaultContext: FilesMachineContext = {
  accessToken: null,
  
  isUploadingFile: false,
  uploadingFileTurnId: null,
  uploadError: null,
  uploadSuccess: null,

  isDeletingFile: false,
  deletingFileTurnId: null,
  deleteError: null,
  deleteSuccess: null,
};

export const filesMachine = createMachine({
  id: FILES_MACHINE_ID,
  initial: "idle",
  context: FilesMachineDefaultContext,
  types: {
    context: {} as FilesMachineContext,
    events: {} as FilesMachineEvent,
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
    // FSEC — logout / session expiry must wipe the in-memory credentials from EVERY
    // machine. A bearer left behind in context is a live, usable credential (the
    // retry-401 path can even leave a freshly minted one here).
    CLEAR_ACCESS_TOKEN: {
      actions: assign({
        accessToken: null,
      }),
    },
  },
  states: {
    idle: {
      on: {
        SET_AUTH: {
          actions: assign({
            accessToken: ({ event }) => event.accessToken,
          }),
        },
        UPLOAD_TURN_FILE: {
          target: "uploadingFile",
          guard: ({ context }) => !!context.accessToken,
        },
        DELETE_TURN_FILE: {
          target: "deletingFile",
          guard: ({ context }) => !!context.accessToken,
        },
        CLEAR_UPLOAD_SUCCESS: {
          actions: assign({
            uploadSuccess: null,
          }),
        },
        CLEAR_DELETE_SUCCESS: {
          actions: assign({
            deleteSuccess: null,
          }),
        },
        CLEAR_ERROR: {
          actions: assign({
            uploadError: null,
            deleteError: null,
          }),
        },
      },
    },

    uploadingFile: {
      entry: assign({
        isUploadingFile: true,
        uploadError: null,
        uploadingFileTurnId: ({ event }) => {
          const turnId = (event as any).turnId;
          return turnId;
        },
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; turnId: string; file: File } }) => {
          return await StorageService.uploadTurnFile(input.accessToken, input.turnId, input.file);
        }),
        input: ({ context, event }) => ({
          accessToken: context.accessToken!,
          turnId: (event as any).turnId,
          file: (event as any).file,
        }),
        onDone: {
          target: "idle",
          actions: [
            () => {
              // Reload turns to get updated file information
              orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
              
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: "Archivo subido exitosamente",
                severity: "success"
              });
            },
            assign({
              isUploadingFile: false,
              uploadingFileTurnId: null,
              uploadSuccess: "Archivo subido exitosamente",
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              isUploadingFile: false,
              uploadingFileTurnId: null,
              uploadError: ({ event }) => (event.error as Error)?.message || "Error al subir archivo",
            }),
            ({ event }) => {
              const errorMessage = (event.error as Error)?.message || "Error al subir archivo";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
    },

    deletingFile: {
      entry: assign({
        isDeletingFile: true,
        deleteError: null,
        deletingFileTurnId: ({ event }) => (event as any).turnId,
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; turnId: string } }) => {
          await StorageService.deleteTurnFile(input.accessToken, input.turnId);
          return input.turnId;
        }),
        input: ({ context, event }) => ({
          accessToken: context.accessToken!,
          turnId: (event as any).turnId,
        }),
        onDone: {
          target: "idle",
          actions: [
            () => {
              // Reload turns to get updated file information
              orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
              
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: "Archivo eliminado exitosamente",
                severity: "success"
              });
            },
            assign({
              isDeletingFile: false,
              deletingFileTurnId: null,
              deleteSuccess: "Archivo eliminado exitosamente",
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              isDeletingFile: false,
              deletingFileTurnId: null,
              deleteError: ({ event }) => (event.error as Error)?.message || "Error al eliminar archivo",
            }),
            ({ event }) => {
              const errorMessage = (event.error as Error)?.message || "Error al eliminar archivo";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
    },
  },
});