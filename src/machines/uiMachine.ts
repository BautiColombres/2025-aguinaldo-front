import { createMachine, assign } from "xstate";
import { orchestrator } from "#/core/Orchestrator";

export const UI_MACHINE_ID = "ui";
export const UI_MACHINE_EVENT_TYPES = ["TOGGLE", "NAVIGATE", "OPEN_SNACKBAR", "CLOSE_SNACKBAR", "OPEN_CONFIRMATION_DIALOG", "OPEN_CANCEL_TURN_DIALOG", "OPEN_COMPLETE_TURN_DIALOG", "OPEN_NO_SHOW_TURN_DIALOG", "CLOSE_CONFIRMATION_DIALOG", "OPEN_NOTIFICATION_MODAL", "CLOSE_NOTIFICATION_MODAL", "OPEN_RATING_MODAL", "CLOSE_RATING_MODAL"];

export interface UiMachineContext {
  toggleStates: Record<string, boolean>;
  currentPath: string;
  navigate: (to: string) => void;
  snackbar: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  };
  confirmDialog: {
    open: boolean;
    action: 'approve' | 'reject' | 'cancel_turn' | 'complete_turn' | 'no_show_turn' | 'delete_file' | 'acknowledge' | null;
    requestId: string | null;
    turnId: string | null;
    turnData?: any;
    title?: string;
    message?: string;
    confirmButtonText?: string;
    confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  };
  notificationModal: {
    open: boolean;
  };
  ratingModal: {
    open: boolean;
    turn: any | null;
  };
}

export type UiMachineEvent =
  | { type: "ADD_NAVIGATE_HOOK"; navigate: (to: string) => void; initialPath: string }
  | { type: "TOGGLE"; key: string }
  | { type: "NAVIGATE"; to: string | null }
  | { type: "OPEN_SNACKBAR"; message: string; severity: 'success' | 'error' | 'warning' | 'info' }
  | { type: "CLOSE_SNACKBAR" }
  | { type: "OPEN_CONFIRMATION_DIALOG"; action: 'approve' | 'reject' | 'delete_file' | 'acknowledge'; requestId?: string; turnId?: string; title?: string; message?: string; confirmButtonText?: string; confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }
  | { type: "OPEN_CANCEL_TURN_DIALOG"; turnId: string; turnData?: any; title?: string; message?: string; confirmButtonText?: string; confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }
  | { type: "OPEN_COMPLETE_TURN_DIALOG"; turnId: string; turnData?: any; title?: string; message?: string; confirmButtonText?: string; confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }
  | { type: "OPEN_NO_SHOW_TURN_DIALOG"; turnId: string; turnData?: any; title?: string; message?: string; confirmButtonText?: string; confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }
  | { type: "CLOSE_CONFIRMATION_DIALOG" }
  | { type: "CLEAR_CONFIRMATION_DIALOG" }
  | { type: "OPEN_NOTIFICATION_MODAL" }
  | { type: "CLOSE_NOTIFICATION_MODAL" }
  | { type: "OPEN_RATING_MODAL"; turn: any }
  | { type: "CLOSE_RATING_MODAL" }
  | { type: "CLEAR_RATING_MODAL" };

export const uiMachine = createMachine({
  id: "ui",
  initial: "idle",
  context: {
    toggleStates: {
      loadingApprove: false,
      loadingReject: false,
    },
    currentPath: "/",
    navigate: (to: string) => { console.log(`Default navigate to: ${to}`); },
    snackbar: {
      open: false,
      message: "",
      severity: "info" as const,
    },
    confirmDialog: { open: false, action: null, requestId: null, turnId: null, turnData: null, title: undefined, message: undefined, confirmButtonText: undefined, confirmButtonColor: undefined },
    notificationModal: { open: false },
    ratingModal: { open: false, turn: null },
  },
  types: { 
    context: {} as UiMachineContext,
    events: {} as UiMachineEvent,
    input: {} as { navigate: (to: string) => void },
  },
  states: { 
    idle: {
      on: { 
        ADD_NAVIGATE_HOOK: {
          actions: [
            assign({
              navigate: ({ event }: any) => event.navigate,
              currentPath: ({ event }: any) => event.initialPath || '/',
            }),
            ({ event }: any) => {
              const initialPath = event.initialPath || '/';
              if (initialPath.startsWith('/patient-detail')) {
                const queryString = initialPath.split('?')[1] || '';
                const patientId = new URLSearchParams(queryString).get('patientId');
                if (patientId) {
                  orchestrator.send({
                    type: "SELECT_PATIENT",
                    patientId: patientId
                  });
                }
              }
              try {
               
                if ((initialPath.startsWith('/patient/view-turns') || initialPath.startsWith('/doctor/view-turns')) && initialPath.includes('turnId=')) {
                  const query = initialPath.split('?')[1] || '';
                  const params = new URLSearchParams(query);
                  const turnId = params.get('turnId');
                  if (turnId) {
                    orchestrator.sendToMachine("data", {
                      type: 'CHECK_URL_CANCEL_TURN',
                      turnId
                    });
                  }
                }
              } catch (e) {
               
              }
            }
          ],
        },
        TOGGLE: {
          actions: assign({
            toggleStates: ({ context, event }) => ({
              ...context.toggleStates,
              [event.key]: !context.toggleStates?.[event.key],
            }), 
          }),
        },
        NAVIGATE: {
          actions: [
            ({ context, event }) => {
              if (event.to) {
                const previousPath = context.currentPath;
                context.navigate(event.to);

                if (event.to.startsWith('/patient-detail') && previousPath !== event.to) {
                  const queryString = event.to.split('?')[1] || '';
                  const patientId = new URLSearchParams(queryString).get('patientId');

                  if (patientId) {
                    orchestrator.send({
                      type: "SELECT_PATIENT",
                      patientId: patientId
                    });
                  }
                  else {
                    orchestrator.send({ type: "CLEAR_PATIENT_SELECTION" });
                  }
                }
              }
            },
            assign({
              currentPath: ({ context, event }) =>
                event.to ? event.to : context.currentPath,
            }),
          ],
        },
        OPEN_SNACKBAR: {
          actions: assign({
            snackbar: ({ event }) => ({
              open: true,
              message: event.message,
              severity: event.severity,
            }),
          }),
        },
        CLOSE_SNACKBAR: {
          actions: [
            assign({
              snackbar: ({ context }) => ({
                ...context.snackbar,
                open: false,
              }),
            }),
            () => {
              orchestrator.send({ type: 'NOTIFICATION_CLOSED' });
            }
          ],
        },
        OPEN_CONFIRMATION_DIALOG: {
          actions: assign({
            confirmDialog: ({ event }) => ({
              open: true,
              action: event.action,
              requestId: event.requestId || null,
              turnId: event.turnId || null,
              turnData: null,
              title: event.title || 'Confirmar Acción',
              message: event.message || '',
              confirmButtonText: event.confirmButtonText || 'Confirmar',
              confirmButtonColor: event.confirmButtonColor || 'primary',
            }),
          }),
        },
        OPEN_CANCEL_TURN_DIALOG: {
          actions: assign({
            confirmDialog: ({ event }) => ({
              open: true,
              action: 'cancel_turn' as const,
              requestId: null,
              turnId: event.turnId,
              turnData: event.turnData,
              title: event.title || 'Confirmar Acción',
              message: event.message || '¿Estás seguro de que quieres cancelar este turno? Esta acción no se puede deshacer.',
              confirmButtonText: event.confirmButtonText || 'Cancelar Turno',
              confirmButtonColor: event.confirmButtonColor || 'error',
            }),
          }),
        },
        OPEN_COMPLETE_TURN_DIALOG: {
          actions: assign({
            confirmDialog: ({ event }) => ({
              open: true,
              action: 'complete_turn' as const,
              requestId: null,
              turnId: event.turnId,
              turnData: event.turnData,
              title: event.title || 'Marcar Turno como Completado',
              message: event.message || '¿Confirmas que este turno fue atendido exitosamente?',
              confirmButtonText: event.confirmButtonText || 'Marcar Completado',
              confirmButtonColor: event.confirmButtonColor || 'success',
            }),
          }),
        },
        OPEN_NO_SHOW_TURN_DIALOG: {
          actions: assign({
            confirmDialog: ({ event }) => ({
              open: true,
              action: 'no_show_turn' as const,
              requestId: null,
              turnId: event.turnId,
              turnData: event.turnData,
              title: event.title || 'Marcar Turno como No Asistió',
              message: event.message || '¿Confirmas que el paciente no asistió a este turno?',
              confirmButtonText: event.confirmButtonText || 'No Asistió',
              confirmButtonColor: event.confirmButtonColor || 'warning',
            }),
          }),
        },
        CLOSE_CONFIRMATION_DIALOG: {
          actions: [
            assign({
              confirmDialog: ({ context }) => ({
                ...context.confirmDialog,
                open: false,
              }),
            }),
            () => {
              setTimeout(() => {
                orchestrator.sendToMachine(UI_MACHINE_ID, { type: "CLEAR_CONFIRMATION_DIALOG" });
              }, 300);
            }
          ],
        },
        CLEAR_CONFIRMATION_DIALOG: {
          actions: assign({
            confirmDialog: () => ({
              open: false,
              action: null,
              requestId: null,
              turnId: null,
              turnData: null,
              title: undefined,
              message: undefined,
              confirmButtonText: undefined,
              confirmButtonColor: undefined,
            }),
          }),
        },
        OPEN_NOTIFICATION_MODAL: {
          actions: assign({
            notificationModal: () => ({
              open: true,
            }),
          }),
        },
        CLOSE_NOTIFICATION_MODAL: {
          actions: assign({
            notificationModal: () => ({
              open: false,
            }),
          }),
        },
        OPEN_RATING_MODAL: {
          actions: [
            assign({
              ratingModal: ({ event }) => ({
                open: true,
                turn: event.turn,
              }),
            }),
            () => {
              const authSnapshot = orchestrator.getSnapshot("auth");
              const userRole = authSnapshot?.context?.authResponse?.role;
              
              orchestrator.sendToMachine("data", { 
                type: "LOAD_RATING_SUBCATEGORIES", 
                role: userRole || "PATIENT"
              });
            }
          ],
        },
        CLOSE_RATING_MODAL: {
          actions: [
            assign({
              ratingModal: ({ context }) => ({
                ...context.ratingModal,
                open: false,
              }),
            }),
            () => {
              setTimeout(() => {
                orchestrator.sendToMachine(UI_MACHINE_ID, { type: "CLEAR_RATING_MODAL" });
              }, 300);
            }
          ],
        },
        CLEAR_RATING_MODAL: {
          actions: assign({
            ratingModal: () => ({
              open: false,
              turn: null,
            }),
          }),
        },
      },
    },
  },
});
