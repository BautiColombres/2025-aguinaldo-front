import { createMachine, assign, fromPromise } from "xstate";
import { BadgeService } from "../service/badge-service.service";
import { orchestrator } from "#/core/Orchestrator";
import { UI_MACHINE_ID } from "./uiMachine";
import type { 
  Badge, 
  BadgeProgress
} from "../models/Badge";

export const BADGE_MACHINE_ID = "badge";
export const BADGE_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  "SET_AUTH",
  "RESET",
  "DATA_LOADED",
  "EVALUATE_BADGES",
];

export interface BadgeMachineContext {
  accessToken: string | null;
  userRole: string | null;
  userId: string | null;
  badges: Badge[];
  progress: BadgeProgress[];
  isEvaluating: boolean;
  evaluationError: string | null;
}

export type BadgeMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'CLEAR_ACCESS_TOKEN' }
  | { type: "SET_AUTH"; accessToken: string; userId: string; userRole?: string }
  | { type: "RESET" }
  | { type: "DATA_LOADED"; userBadges: Badge[]; userBadgeProgress: BadgeProgress[] }
  | { type: "EVALUATE_BADGES" };

const badgeMachine = createMachine({
  id: "badge",
  initial: "idle",

  context: {
    accessToken: null,
    userRole: null,
    userId: null,
    badges: [],
    progress: [],
    isEvaluating: false,
    evaluationError: null,
  } as BadgeMachineContext,

  states: {
    idle: {
      on: {
        DATA_LOADED: {
          actions: [
            assign({
              badges: ({ event }) => event.userBadges || [],
              progress: ({ event }) => event.userBadgeProgress || [],
            }),
          ],
        },
        EVALUATE_BADGES: {
          guard: ({ context }) => !!context.accessToken && !!context.userId && isBadgeEligible(context),
          target: "evaluating",
        },
      },
    },

    evaluating: {
      entry: assign({
        isEvaluating: true,
        evaluationError: null,
      }),

      invoke: {
        src: fromPromise(async ({ input }: { 
          input: { accessToken: string; userId: string } 
        }) => {
          await BadgeService.evaluateUserBadges(input.accessToken, input.userId);
        }),

        input: ({ context }) => ({
          accessToken: context.accessToken!,
          userId: context.userId!,
        }),

        onDone: {
          target: "idle",
          actions: [
            assign({
              isEvaluating: false,
              evaluationError: null,
            }),
            () => {
              orchestrator.sendToMachine(UI_MACHINE_ID, { 
                type: "OPEN_SNACKBAR", 
                message: "Badges recalculados exitosamente", 
                severity: "success" 
              });
            }
          ],
        },

        onError: {
          target: "idle",
          actions: [
            assign({
              isEvaluating: false,
              evaluationError: ({ event }) => {
                const error = event.error as Error;
                console.error('[BADGE_MACHINE] Badge evaluation failed:', error);
                return error?.message || "Error al evaluar badges";
              },
            }),
            ({ event }) => {
              const error = event.error as Error;
              console.error('[BadgeMachine] Error evaluating badges:', error);
              orchestrator.sendToMachine(UI_MACHINE_ID, { 
                type: "OPEN_SNACKBAR", 
                message: error?.message || "Error al recalcular badges", 
                severity: "error" 
              });
            }
          ],
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
    // FSEC — logout / session expiry must wipe the in-memory credentials from EVERY
    // machine. A bearer left behind in context is a live, usable credential (the
    // retry-401 path can even leave a freshly minted one here).
    CLEAR_ACCESS_TOKEN: {
      actions: assign({
        accessToken: null,
        userRole: null,
        userId: null,
      }),
    },
    SET_AUTH: {
      actions: [
        assign(({ context, event }) => {
          if (context.userRole && context.userRole !== event.userRole) {
            return {
              accessToken: event.accessToken,
              userRole: event.userRole,
              userId: event.userId,
              badges: [],
              progress: [],
              evaluationError: null,
              isEvaluating: false,
            };
          }
          return {
            accessToken: event.accessToken,
            userRole: event.userRole,
            userId: event.userId,
          };
        })
      ],
    },
    RESET: {
      actions: assign({
        badges: [],
        progress: [],
        evaluationError: null,
        isEvaluating: false,
      }),
    },
  },
});

export default badgeMachine;

const isBadgeEligible = (context: BadgeMachineContext) => {
  return ['DOCTOR', 'PATIENT'].includes(context.userRole || '');
};