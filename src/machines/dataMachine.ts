import { createMachine, assign, fromPromise } from "xstate";
import { loadDoctors, loadPendingDoctors, loadAdminStats, loadAvailableTurns, loadMyTurns, loadDoctorModifyRequests, loadMyModifyRequests, loadSpecialties, loadRatingSubcategories, loadAdminRatings } from "../utils/MachineUtils/dataMachineUtils";
import { loadDoctorPatients, loadDoctorAvailability } from "../utils/MachineUtils/doctorMachineUtils";
import { loadCombinedBadgeData } from "../utils/MachineUtils/badgeMachineUtils";
import { orchestrator } from "#/core/Orchestrator";
import { classifyApiError } from "../../config/api";
import type { PendingDoctor, AdminStats } from "../models/Admin";
import type { Doctor } from "../models/Turn";
import { UI_MACHINE_ID } from "./uiMachine";
import { TurnModifyRequest } from "#/models/TurnModifyRequest";
import type { Badge, BadgeProgress } from "../models/Badge";

export const DATA_MACHINE_ID = "data";
export const DATA_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  "SET_AUTH",
  "CLEAR_ACCESS_TOKEN", 
  "RELOAD_DOCTORS",
  "RELOAD_SPECIALTIES",
  "RELOAD_PENDING_DOCTORS", 
  "RELOAD_ADMIN_STATS",
  "RELOAD_ADMIN_RATINGS",
  "RELOAD_ALL",
  "LOAD_AVAILABLE_TURNS",
  "LOAD_MY_TURNS",
  "LOAD_DOCTOR_PATIENTS",
  "LOAD_DOCTOR_AVAILABILITY",
  "LOAD_DOCTOR_MODIFY_REQUESTS",
  "LOAD_MY_MODIFY_REQUESTS",
  "UPDATE_TURNS_NEEDING_RATING",
  "LOAD_RATING_SUBCATEGORIES"
];

export interface DataMachineContext {
  accessToken: string | null;
  userRole: string | null;
  userId: string | null;
  doctorId: string | null;
  
  doctors: Doctor[];
  specialties: string[];
  pendingDoctors: PendingDoctor[];
  adminStats: AdminStats;
  availableTurns: string[];
  myTurns: any[];
  doctorPatients: any[];
  doctorAvailability: any[];
  doctorModifyRequests: TurnModifyRequest[];
  myModifyRequests: TurnModifyRequest[];
  turnsNeedingRating: any[];
  ratingSubcategories: string[];
  ratedSubcategoryCounts: Record<string, { subcategory: string | null; count: number }[]>;
  ratingModalChecked: boolean;
  adminRatings: any;
  userBadges: Badge[];
  userBadgeProgress: BadgeProgress[];
  
  pendingCancelTurnId: string | null;

  loading: {
    doctors: boolean;
    specialties: boolean;
    pendingDoctors: boolean;
    adminStats: boolean;
    availableTurns: boolean;
    myTurns: boolean;
    doctorPatients: boolean;
    doctorAvailability: boolean;
    doctorModifyRequests: boolean;
    myModifyRequests: boolean;
    turnsNeedingRating: boolean;
    ratingSubcategories: boolean;
    adminRatings: boolean;
    ratedSubcategoryCounts: boolean;
    userBadges: boolean;
    userBadgeProgress: boolean;
    initializing: boolean;
  };
  
  errors: {
    doctors: string | null;
    specialties: string | null;
    pendingDoctors: string | null;
    adminStats: string | null;
    availableTurns: string | null;
    myTurns: string | null;
    doctorPatients: string | null;
    doctorAvailability: string | null;
    doctorModifyRequests: string | null;
    myModifyRequests: string | null;
    turnsNeedingRating: string | null;
    ratingSubcategories: string | null;
    adminRatings: string | null;
    ratedSubcategoryCounts: string | null;
    userBadges: string | null;
    userBadgeProgress: string | null;
  };
}

export const DataMachineDefaultContext: DataMachineContext = {
  accessToken: null,
  userRole: null,
  userId: null,
  doctorId: null,
  
  doctors: [],
  specialties: [],
  pendingDoctors: [],
  adminStats: { patients: 0, doctors: 0, pending: 0 },
  availableTurns: [],
  myTurns: [],
  doctorPatients: [],
  doctorAvailability: [],
  doctorModifyRequests: [],
  myModifyRequests: [],
  turnsNeedingRating: [],
  ratingSubcategories: [],
  ratedSubcategoryCounts: {},
  ratingModalChecked: false,
  adminRatings: null,
  userBadges: [],
  userBadgeProgress: [],
  
  pendingCancelTurnId: null,

  loading: {
    doctors: false,
    specialties: false,
    pendingDoctors: false,
    adminStats: false,
    availableTurns: false,
    myTurns: false,
    doctorPatients: false,
    doctorAvailability: false,
    doctorModifyRequests: false,
    myModifyRequests: false,
    turnsNeedingRating: false,
    ratingSubcategories: false,
    adminRatings: false,
    ratedSubcategoryCounts: false,
    userBadges: false,
    userBadgeProgress: false,
    initializing: false,
  },
  
  errors: {
    doctors: null,
    specialties: null,
    pendingDoctors: null,
    adminStats: null,
    availableTurns: null,
    myTurns: null,
    doctorPatients: null,
    doctorAvailability: null,
    doctorModifyRequests: null,
    myModifyRequests: null,
    turnsNeedingRating: null,
    ratingSubcategories: null,
    adminRatings: null,
    ratedSubcategoryCounts: null,
    userBadges: null,
    userBadgeProgress: null,
  },
};

export type DataMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: "SET_AUTH"; accessToken: string; userId: string; userRole: string; doctorId?: string }
  | { type: "CLEAR_ACCESS_TOKEN" }
  | { type: "RELOAD_DOCTORS" }
  | { type: "RELOAD_SPECIALTIES" }
  | { type: "RELOAD_PENDING_DOCTORS" }
  | { type: "RELOAD_ADMIN_STATS" }
  | { type: "RELOAD_ADMIN_RATINGS" }
  | { type: "RELOAD_ALL" }
  | { type: "LOAD_AVAILABLE_TURNS"; doctorId: string; date: string }
  | { type: "LOAD_MY_TURNS"; status?: string }
  | { type: "LOAD_DOCTOR_PATIENTS" }
  | { type: "LOAD_DOCTOR_AVAILABILITY"; doctorId?: string }
  | { type: "LOAD_DOCTOR_MODIFY_REQUESTS"; doctorId?: string }
  | { type: "LOAD_MY_MODIFY_REQUESTS" }
  | { type: "UPDATE_TURNS_NEEDING_RATING"; turns: any[] }
  | { type: "LOAD_RATING_SUBCATEGORIES"; role?: string }
  | { type: "LOAD_RATED_SUBCATEGORY_COUNTS"; doctorIds: string[] }
  | { type: "CHECK_URL_CANCEL_TURN"; turnId: string };

export const dataMachine = createMachine({
  id: "data",
  initial: "idle",
  context: DataMachineDefaultContext,
  on: {
    // FBUG-003 — the interceptor silently refreshed the access token (401 -> refresh
    // -> retry). Adopt it IN PLACE: pure assign, no target, no refetch. Do NOT reuse
    // SET_AUTH here — that means "a session just started" and re-bootstraps machines.
    TOKEN_REFRESHED: {
      actions: assign({
        accessToken: ({ event }) => event.accessToken,
      }),
    },
    // Covers the fetching* states too (idle/ready define their own richer reset):
    // abort whatever is in flight and drop the credentials.
    CLEAR_ACCESS_TOKEN: {
      target: ".idle",
      actions: assign({
        accessToken: null,
        userRole: null,
        userId: null,
        doctorId: null,
      }),
    },
    CHECK_URL_CANCEL_TURN: {
      actions: assign({
        pendingCancelTurnId: ({ event }) => event.turnId
      })
    }
  },
  types: {
    context: {} as DataMachineContext,
    events: {} as DataMachineEvent,
  },
  states: {
    idle: {
      on: {
        SET_AUTH: [
          {
            guard: ({ event }) => event.userRole === "DOCTOR",
            target: "fetchingRatingSubcategories",
            actions: [
              assign({
                accessToken: ({ event }) => event.accessToken,
                userRole: ({ event }) => event.userRole,
                userId: ({ event }) => event.userId,
                doctorId: ({ event }) => event.userRole === "DOCTOR" ? event.userId : null,
                loading: ({ context }) => ({ ...context.loading, initializing: true }),
              }),
              () => {
                orchestrator.sendToMachine("notification", {
                  type: "LOAD_NOTIFICATIONS"
                });
              }
            ],
          },
          {
            target: "fetchingDoctors",
            actions: [
              assign({
                accessToken: ({ event }) => event.accessToken,
                userRole: ({ event }) => event.userRole,
                userId: ({ event }) => event.userId,
                doctorId: ({ event }) => event.userRole === "DOCTOR" ? event.userId : null,
                loading: ({ context }) => ({ ...context.loading, initializing: true }),
              }),
              () => {
                orchestrator.sendToMachine("notification", {
                  type: "LOAD_NOTIFICATIONS"
                });
              }
            ],
          }
        ],
        CLEAR_ACCESS_TOKEN: {
          actions: assign({
            accessToken: null,
            userRole: null,
            userId: null,
            doctorId: null,
            doctors: [],
            pendingDoctors: [],
            adminStats: { patients: 0, doctors: 0, pending: 0 },
            availableTurns: [],
            myTurns: [],
            doctorPatients: [],
            doctorAvailability: [],
            doctorModifyRequests: [],
            myModifyRequests: [],
            ratingSubcategories: [],
            ratedSubcategoryCounts: {},
            ratingModalChecked: false,
            adminRatings: null,
            userBadges: [],
            userBadgeProgress: [],
            loading: ({ context }) => ({ ...context.loading, initializing: false }),
          }),
        },
        RELOAD_DOCTORS: {
          target: "fetchingDoctors",
          guard: ({ context }) => !!context.accessToken,
        },
        RELOAD_SPECIALTIES: {
          target: "fetchingSpecialties",
          guard: ({ context }) => !!context.accessToken,
        },
        RELOAD_PENDING_DOCTORS: {
          target: "fetchingPendingDoctors",
          guard: ({ context }) => !!context.accessToken,
        },
        RELOAD_ADMIN_STATS: {
          target: "fetchingAdminStats",
          guard: ({ context }) => !!context.accessToken,
        },
        RELOAD_ADMIN_RATINGS: {
          target: "fetchingAdminRatings",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_AVAILABLE_TURNS: {
          target: "fetchingAvailableTurns",
          guard: ({ context, event }) => !!context.accessToken && !!(event as any).doctorId && !!(event as any).date,
        },
        LOAD_MY_TURNS: {
          target: "fetchingMyTurns",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_DOCTOR_PATIENTS: {
          target: "fetchingDoctorPatients",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_DOCTOR_AVAILABILITY: {
          target: "fetchingDoctorAvailability",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_DOCTOR_MODIFY_REQUESTS: {
          target: "fetchingDoctorModifyRequests",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_MY_MODIFY_REQUESTS: {
          target: "fetchingMyModifyRequests",
          guard: ({ context }) => !!context.accessToken,
        },
      },
    },
    
    ready: {
      entry: [
        ({ context }) => {
          setTimeout(() => {
            orchestrator.send({
              type: "DATA_LOADED",
              doctorAvailability: context.doctorAvailability,
              userBadges: context.userBadges,
              userBadgeProgress: context.userBadgeProgress
            });
            
          }, 0);

          if (context.pendingCancelTurnId && context.myTurns) {
            const turn = context.myTurns.find((t: any) => t.id === context.pendingCancelTurnId);
            if (turn) {
              if (turn.status === 'CANCELED') {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_CONFIRMATION_DIALOG',
                  action: 'acknowledge',
                  turnId: context.pendingCancelTurnId,
                  title: 'Turno Cancelado',
                  message: 'El turno ya se encuentra cancelado.',
                  confirmButtonText: 'Continuar',
                  confirmButtonColor: 'primary'
                });
              } else {
                orchestrator.sendToMachine(UI_MACHINE_ID, {
                  type: 'OPEN_CANCEL_TURN_DIALOG',
                  turnId: context.pendingCancelTurnId,
                  turnData: turn,
                  title: 'Cancelar Turno',
                  message: '¿Estás seguro de que quieres cancelar este turno? Esta acción no se puede deshacer.',
                  confirmButtonText: 'Cancelar Turno',
                  confirmButtonColor: 'error'
                });
              }
            }
          }
        },
        assign({
          pendingCancelTurnId: null,
          loading: ({ context }) => ({ ...context.loading, initializing: false }),
        })
      ],
      exit: () => {
        orchestrator.send({
          type: "LOADING"
        });
      },
      on: {
        CHECK_URL_CANCEL_TURN: {
          actions: ({ context, event }) => {
             const turn = context.myTurns?.find((t: any) => t.id === event.turnId);
             if (turn) {
               if (turn.status === 'CANCELED') {
                 orchestrator.sendToMachine(UI_MACHINE_ID, {
                   type: 'OPEN_CONFIRMATION_DIALOG',
                   action: 'acknowledge',
                   turnId: event.turnId,
                   title: 'Turno Cancelado',
                   message: 'El turno ya se encuentra cancelado.',
                   confirmButtonText: 'Continuar',
                   confirmButtonColor: 'primary'
                 });
               } else {
                  orchestrator.sendToMachine(UI_MACHINE_ID, {
                    type: 'OPEN_CANCEL_TURN_DIALOG',
                    turnId: event.turnId,
                    turnData: turn,
                    title: 'Cancelar Turno',
                    message: '¿Estás seguro de que quieres cancelar este turno? Esta acción no se puede deshacer.',
                    confirmButtonText: 'Cancelar Turno',
                    confirmButtonColor: 'error'
                  });
               }
             }
          }
        },
        SET_AUTH: {
          target: "fetchingDoctors",
          actions: assign({
            accessToken: ({ event }) => event.accessToken,
            userRole: ({ event }) => event.userRole,
            userId: ({ event }) => event.userId,
            doctorId: ({ event }) => event.userRole === "DOCTOR" ? event.userId : null,
          }),
        },
        CLEAR_ACCESS_TOKEN: {
          target: "idle",
          actions: assign({
            accessToken: null,
            userRole: null,
            userId: null,
            doctorId: null,
            doctors: [],
            pendingDoctors: [],
            adminStats: { patients: 0, doctors: 0, pending: 0 },
            availableTurns: [],
            myTurns: [],
            doctorPatients: [],
            doctorAvailability: [],
            doctorModifyRequests: [],
            myModifyRequests: [],
            ratingModalChecked: false,
            adminRatings: null,
            ratingSubcategories: [],
            turnsNeedingRating: [],
            userBadges: [],
            userBadgeProgress: [],
          }),
        },
        RELOAD_DOCTORS: {
          target: "fetchingDoctors",
        },
        RELOAD_PENDING_DOCTORS: {
          target: "fetchingPendingDoctors",
        },
        RELOAD_SPECIALTIES: {
          target: "fetchingSpecialties",
        },
        RELOAD_ADMIN_STATS: {
          target: "fetchingAdminStats",
        },
        RELOAD_ADMIN_RATINGS: {
          target: "fetchingAdminRatings",
        },
        RELOAD_ALL: [
          {
            guard: ({ context }) => context.userRole === "ADMIN",
            actions: ({ self }) => {
              // Send multiple reload events for ADMIN
              setTimeout(() => {
                self.send({ type: "RELOAD_DOCTORS" });
                self.send({ type: "RELOAD_PENDING_DOCTORS" });
                self.send({ type: "RELOAD_ADMIN_STATS" });
                self.send({ type: "RELOAD_ADMIN_RATINGS" });
                self.send({ type: "RELOAD_SPECIALTIES" });
              }, 0);
            },
          },
          {
            actions: () => {
              // For non-admin users, just reload doctors
              // Could be extended for other roles
            },
          },
        ],
        LOAD_AVAILABLE_TURNS: {
          target: "fetchingAvailableTurns",
          guard: ({ context, event }) => !!context.accessToken && !!(event as any).doctorId && !!(event as any).date,
        },
        LOAD_MY_TURNS: {
          target: "fetchingMyTurns",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_DOCTOR_PATIENTS: {
          target: "fetchingDoctorPatients",
        },
        LOAD_DOCTOR_AVAILABILITY: {
          target: "fetchingDoctorAvailability",
        },
        LOAD_DOCTOR_MODIFY_REQUESTS: {
          target: "fetchingDoctorModifyRequests",
        },
        LOAD_MY_MODIFY_REQUESTS: {
          target: "fetchingMyModifyRequests",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_RATED_SUBCATEGORY_COUNTS: {
          target: "fetchingRatedSubcategoryCounts",
          guard: ({ context }) => !!context.accessToken,
        },
        LOAD_RATING_SUBCATEGORIES: {
          target: "fetchingRatingSubcategories",
        },
        UPDATE_TURNS_NEEDING_RATING: {
          actions: assign({
            turnsNeedingRating: ({ event }) => (event as any).turns,
            ratingModalChecked: true,
          })
        },
      },
    },
    fetchingDoctors: {
      entry: [
        () => orchestrator.send({ type: "LOADING" }),
        assign({
          loading: ({ context }) => ({ ...context.loading, doctors: true }),
          errors: ({ context }) => ({ ...context.errors, doctors: null }),
        })
      ],
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadDoctors(input);
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: [
          {
            target: "fetchingSpecialties",
            guard: ({ context }) => context.userRole === "ADMIN",
            actions: assign({
              doctors: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, doctors: false }),
            }),
          },
          {
            target: "fetchingRatingSubcategories",
            guard: ({ context }) => context.userRole === "DOCTOR" || context.userRole === "PATIENT",
            actions: assign({
              doctors: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, doctors: false }),
            }),
          },
          {
            target: "ready",
            actions: assign({
              doctors: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, doctors: false }),
            }),
          },
        ],
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                doctors: classifyApiError(event.error, "Error al cargar doctores").message
              }),
              loading: ({ context }) => ({
                ...context.loading,
                doctors: false
              })
            }),
            ({ event }) => {
              const classified = classifyApiError(event.error, "Error al cargar doctores");
              // FBUG-003 — the interceptor owns the 401 path (refresh/retry, then
              // SESSION_EXPIRED). Stay quiet so the user gets ONE message, not two.
              if (classified.kind === 'unauthorized') {
                return;
              }
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: classified.message,
                severity: "error"
              });
            }
          ],
        },
      },
    },
    
    fetchingSpecialties: {
      entry: [
        assign({
          loading: ({ context }) => ({ ...context.loading, specialties: true }),
          errors: ({ context }) => ({ ...context.errors, specialties: null }),
        }),
      ],
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadSpecialties(input);
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: "fetchingPendingDoctors",
          actions: [
            assign({
              specialties: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, specialties: false }),
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                specialties: event.error instanceof Error ? event.error.message : "Error al cargar especialidades"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                specialties: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar especialidades";
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
    
    fetchingPendingDoctors: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, pendingDoctors: true }),
        errors: ({ context }) => ({ ...context.errors, pendingDoctors: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadPendingDoctors({ accessToken: input.accessToken, isAdmin: true });
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: "fetchingAdminStats",
          actions: assign({
            pendingDoctors: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, pendingDoctors: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                pendingDoctors: event.error instanceof Error ? event.error.message : "Error al cargar doctores pendientes"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                pendingDoctors: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar doctores pendientes";
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
    
    fetchingAdminStats: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, adminStats: true }),
        errors: ({ context }) => ({ ...context.errors, adminStats: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadAdminStats({ accessToken: input.accessToken, isAdmin: true });
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: "fetchingAdminRatings",
          actions: assign({
            adminStats: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, adminStats: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                adminStats: event.error instanceof Error ? event.error.message : "Error al cargar estadísticas"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                adminStats: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar estadísticas";
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
    
    fetchingAvailableTurns: {
      entry: [
        assign({
          loading: ({ context }) => ({ ...context.loading, availableTurns: true }),
          errors: ({ context }) => ({ ...context.errors, availableTurns: null }),
        }),
        () => {
          orchestrator.sendToMachine("turn", {
            type: "SET_AVAILABLE_SLOTS_LOADING",
            isLoading: true,
          });
        },
      ],
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string; date: string } }) => {
          const result = await loadAvailableTurns(input);
          return result;
        }),
        input: ({ context, event }) => ({
          accessToken: context.accessToken!,
          doctorId: (event as any).doctorId,
          date: (event as any).date
        }),
        onDone: {
          target: "ready",
          actions: [
            assign({
              availableTurns: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, availableTurns: false }),
            }),
            () => {
              orchestrator.sendToMachine("turn", {
                type: "SET_AVAILABLE_SLOTS_LOADING",
                isLoading: false,
              });
            },
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                availableTurns: event.error instanceof Error ? event.error.message : "Error al cargar turnos disponibles"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                availableTurns: false
              })
            }),
            () => {
              orchestrator.sendToMachine("turn", {
                type: "SET_AVAILABLE_SLOTS_LOADING",
                isLoading: false,
              });
            },
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar turnos disponibles";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
      on: {
        LOAD_MY_TURNS: {
          target: "fetchingMyTurns",
        },
      },
    },
    
    fetchingMyTurns: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, myTurns: true }),
        errors: ({ context }) => ({ ...context.errors, myTurns: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; status?: string } }) => {
          return await loadMyTurns(input);
        }),
        input: ({ context, event }) => ({
          accessToken: context.accessToken!,
          status: (event as any).status
        }),
        onDone: [
          {
            target: "fetchingDoctorPatients",
            guard: ({ context }) => context.userRole === "DOCTOR",
            actions: assign({
              myTurns: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, myTurns: false }),
            }),
          },
          {
            target: "fetchingUserBadges",
            guard: ({ context }) => context.userRole === "PATIENT",
            actions: [
              assign({
                myTurns: ({ event }) => event.output,
                loading: ({ context }) => ({ ...context.loading, myTurns: false }),
              }),
              ({ context, event }) => {
                if (!context.ratingModalChecked && context.userRole === "PATIENT") {
                  // Filter turns that need patient rating
                  const myTurns = event.output || [];
                  const turnsNeedingRating = myTurns.filter((turn: any) => turn.needsPatientRating === true);
                  
                  if (turnsNeedingRating.length > 0) {
                    setTimeout(() => {
                      const uiSnapshot = orchestrator.getSnapshot(UI_MACHINE_ID);
                      if (!uiSnapshot?.context?.ratingModal?.open) {
                        orchestrator.sendToMachine(UI_MACHINE_ID, {
                          type: "OPEN_RATING_MODAL",
                          turn: turnsNeedingRating[0]
                        });
                      }
                    }, 100);
                  }
                  
                  // Update turnsNeedingRating in context
                  orchestrator.sendToMachine("data", { 
                    type: "UPDATE_TURNS_NEEDING_RATING", 
                    turns: turnsNeedingRating 
                  });
                }
              }
            ],
          },
          {
            target: "ready",
            actions: assign({
              myTurns: ({ event }) => event.output,
              loading: ({ context }) => ({ ...context.loading, myTurns: false }),
            }),
          },
        ],
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                myTurns: event.error instanceof Error ? event.error.message : "Error al cargar mis turnos"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                myTurns: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar mis turnos";
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
    
    fetchingDoctorPatients: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, doctorPatients: true }),
        errors: ({ context }) => ({ ...context.errors, doctorPatients: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string } }) => {
          return await loadDoctorPatients(input);
        }),
        input: ({ context }) => ({ 
          accessToken: context.accessToken!,
          doctorId: context.doctorId!
        }),
        onDone: {
          target: "fetchingDoctorAvailability",
          actions: assign({
            doctorPatients: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, doctorPatients: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                doctorPatients: event.error instanceof Error ? event.error.message : "Error al cargar pacientes del doctor"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                doctorPatients: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar pacientes del doctor";
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
    
    fetchingDoctorAvailability: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, doctorAvailability: true }),
        errors: ({ context }) => ({ ...context.errors, doctorAvailability: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string } }) => {
          return await loadDoctorAvailability(input);
        }),
        input: ({ context, event }) => ({ 
          accessToken: context.accessToken!,
          doctorId: (event as any).doctorId || context.doctorId!
        }),
        onDone: {
          target: "fetchingDoctorModifyRequests",
          actions: assign({
            doctorAvailability: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, doctorAvailability: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                doctorAvailability: event.error instanceof Error ? event.error.message : "Error al cargar disponibilidad del doctor"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                doctorAvailability: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar disponibilidad del doctor";
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

    fetchingDoctorModifyRequests: {
      entry: [
        assign({
          loading: ({ context }) => ({ ...context.loading, doctorModifyRequests: true }),
          errors: ({ context }) => ({ ...context.errors, doctorModifyRequests: null }),
        })
      ],
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string } }) => {
          return await loadDoctorModifyRequests(input);
        }),
        input: ({ context, event }) => ({
          accessToken: context.accessToken!,
          doctorId: (event as any).doctorId || context.doctorId!
        }),
        onDone: {
          target: "fetchingUserBadges",
          actions: assign({
            doctorModifyRequests: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, doctorModifyRequests: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                doctorModifyRequests: event.error instanceof Error ? event.error.message : "Error al cargar solicitudes de modificación"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                doctorModifyRequests: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar solicitudes de modificación";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
      on: {
        LOAD_MY_TURNS: {
          target: "fetchingMyTurns",
        },
      },
    },
    
    fetchingMyModifyRequests: {
      entry: [
        assign({
          loading: ({ context }) => ({ ...context.loading, myModifyRequests: true }),
          errors: ({ context }) => ({ ...context.errors, myModifyRequests: null }),
        })
      ],
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadMyModifyRequests(input);
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: "ready",
          actions: assign({
            myModifyRequests: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, myModifyRequests: false }),
          }),
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                myModifyRequests: event.error instanceof Error ? event.error.message : "Error al cargar mis solicitudes de modificación"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                myModifyRequests: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar mis solicitudes de modificación";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
      on: {
        UPDATE_TURNS_NEEDING_RATING: {
          actions: assign({
            turnsNeedingRating: ({ event }) => (event as any).turns,
            ratingModalChecked: true,
          })
        },
      },
    },

    fetchingAdminRatings: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, adminRatings: true }),
        errors: ({ context }) => ({ ...context.errors, adminRatings: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          return await loadAdminRatings({ accessToken: input.accessToken, isAdmin: true });
        }),
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: "ready",
          actions: assign({
            adminRatings: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, adminRatings: false }),
          }),
        },
        onError: {
          target: "ready",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                adminRatings: event.error instanceof Error ? event.error.message : "Error al cargar ratings de administrador"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                adminRatings: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar ratings de administrador";
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

    fetchingRatingSubcategories: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, ratingSubcategories: true }),
        errors: ({ context }) => ({ ...context.errors, ratingSubcategories: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }) => {
          return await loadRatingSubcategories(input);
        }),
        input: ({ context }) => ({
          role: context.userRole,
          accessToken: context.accessToken,
        }),
        onDone: {
          target: "fetchingMyTurns",
          actions: assign({
            ratingSubcategories: ({ event }) => event.output,
            loading: ({ context }) => ({ ...context.loading, ratingSubcategories: false }),
          }),
        },
        onError: {
          target: "fetchingMyTurns",
          actions: [
            assign({
              loading: ({ context }) => ({ ...context.loading, ratingSubcategories: false }),
              errors: ({ context, event }) => ({
                ...context.errors,
                ratingSubcategories: event.error instanceof Error ? event.error.message : "Error al cargar subcategorías de rating"
              }),
            }),
          ],
        },
      },
    },
    fetchingRatedSubcategoryCounts: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, ratedSubcategoryCounts: true }),
        errors: ({ context }) => ({ ...context.errors, ratedSubcategoryCounts: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { doctorIds: string[]; accessToken?: string } }) => {
          const { loadRatedSubcategoryCounts } = await import('../utils/MachineUtils/dataMachineUtils');
          return await loadRatedSubcategoryCounts({ doctorIds: input.doctorIds, accessToken: input.accessToken });
        }),
        input: ({ context, event }) => ({
          doctorIds: (event as any).doctorIds || [],
          accessToken: context.accessToken,
        }),
        onDone: {
          target: 'ready',
          actions: assign({
            ratedSubcategoryCounts: ({ context, event }) => ({ ...context.ratedSubcategoryCounts, ...event.output }),
            loading: ({ context }) => ({ ...context.loading, ratedSubcategoryCounts: false }),
          }),
        },
        onError: {
          target: 'ready',
          actions: [
            assign({
              loading: ({ context }) => ({ ...context.loading, ratedSubcategoryCounts: false }),
              errors: ({ context, event }) => ({
                ...context.errors,
                ratedSubcategoryCounts: event.error instanceof Error ? event.error.message : 'Error al cargar conteos de subcategorías'
              }),
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const message = event.error instanceof Error ? event.error.message : 'Error al cargar conteos de subcategorías';
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

    fetchingUserBadges: {
      entry: assign({
        loading: ({ context }) => ({ ...context.loading, userBadges: true, userBadgeProgress: true }),
        errors: ({ context }) => ({ ...context.errors, userBadges: null, userBadgeProgress: null }),
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; userId: string } }) => {
          return await loadCombinedBadgeData(input);
        }),
        input: ({ context }) => ({ accessToken: context.accessToken!, userId: context.userId! }),
        onDone: {
          target: "ready",
          actions: [
            assign({
              userBadges: ({ event }) => event.output.badges,
              userBadgeProgress: ({ event }) => event.output.progress,
              loading: ({ context }) => ({ ...context.loading, userBadges: false, userBadgeProgress: false }),
            }),
            ({ context }) => {
              // Send combined data to badge machine
              setTimeout(() => {
                orchestrator.sendToMachine("badge", {
                  type: "DATA_LOADED",
                  userBadges: context.userBadges,
                  userBadgeProgress: context.userBadgeProgress
                });
              }, 0);
            }
          ],
        },
        onError: {
          target: "ready",
          actions: [
            assign({
              errors: ({ context, event }) => ({
                ...context.errors,
                userBadges: event.error instanceof Error ? event.error.message : "Error al cargar badges del usuario",
                userBadgeProgress: event.error instanceof Error ? event.error.message : "Error al cargar progreso de badges del usuario"
              }),
              loading: ({ context }) => ({
                ...context.loading,
                userBadges: false,
                userBadgeProgress: false
              })
            }),
            ({ event }) => {
              // FBUG-003 — the interceptor owns the 401 path end to end (refresh + retry, and
              // SESSION_EXPIRED when it is terminal). Reporting it again here would stack a
              // second snackbar and send a stray LOGOUT to an already-idle authMachine.
              if (classifyApiError(event.error).kind === 'unauthorized') {
                return;
              }
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al cargar datos de badges del usuario";
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: errorMessage,
                severity: "error"
              });
            }
          ],
        },
      },
      on: {
        UPDATE_TURNS_NEEDING_RATING: {
          actions: assign({
            turnsNeedingRating: ({ event }) => (event as any).turns,
            ratingModalChecked: true,
          })
        },
      },
    },
  },
});
