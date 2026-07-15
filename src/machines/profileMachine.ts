import { createMachine, assign, fromPromise } from "xstate";
import { loadProfile, updateProfile, deactivateAccount } from "../utils/MachineUtils/profileMachineUtils";
import { orchestrator } from "#/core/Orchestrator";
import type { ProfileResponse } from "../models/Auth";
import { UI_MACHINE_ID } from "./uiMachine";
import { validateField } from "../utils/authFormValidation";
import type { AuthMachineContext } from "./authMachine";

export const PROFILE_MACHINE_ID = "profile";
export const PROFILE_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  "SET_AUTH",
  "LOGOUT",
  "LOAD_PROFILE",
  "SAVE_PROFILE",
  "UPDATE_PROFILE", 
  "CANCEL_PROFILE_EDIT",
  "DEACTIVATE_ACCOUNT",
  "UPDATE_FORM",
  "INIT_PROFILE_PAGE",
  "CLEAR_ERROR"
];

export interface ProfileMachineContext {
  profile: ProfileResponse | null;
  updatingProfile: boolean;
  loading: boolean;
  error: string | null;
  accessToken: string | null;
  userId: string | null;
  formValues: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    dni: string;
    gender: string;
    birthdate: string | null;
    specialty: string | null;
    medicalLicense: string | null;
    slotDurationMin: number | null;
  };
  formErrors: Record<string, string>;
}

export const ProfileMachineDefaultContext: ProfileMachineContext = {
  profile: null,
  updatingProfile: false,
  loading: false,
  error: null,
  accessToken: null,
  userId: null,
  formValues: {
    name: "",
    surname: "",
    email: "",
    phone: "",
    dni: "",
    gender: "",
    birthdate: null,
    specialty: null,
    medicalLicense: null,
    slotDurationMin: null,
  },
  formErrors: {},
};

const buildValidationContext = (
  context: ProfileMachineContext,
  formValues: ProfileMachineContext["formValues"],
): AuthMachineContext => ({
  mode: "register",
  isPatient: (context.profile?.role ?? "PATIENT") !== "DOCTOR",
  hasErrorsOrEmpty: false,
  isAuthenticated: false,
  loading: false,
  loggingOut: false,
  formValues: {
    email: formValues.email ?? "",
    password: "",
    name: formValues.name ?? "",
    surname: formValues.surname ?? "",
    dni: formValues.dni ?? "",
    gender: formValues.gender ?? "",
    birthdate: formValues.birthdate ?? null,
    password_confirm: "",
    phone: formValues.phone ?? "",
    specialty: formValues.specialty ?? null,
    medicalLicense: formValues.medicalLicense ?? null,
    slotDurationMin: formValues.slotDurationMin ?? null,
  },
  formErrors: {},
  authResponse: null,
  send: () => undefined,
});

export type ProfileMachineEvent =
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'CLEAR_ACCESS_TOKEN' }
  | { type: "SET_AUTH"; accessToken: string; userId: string; userRole?: string }
  | { type: "LOGOUT" }
  | { type: "LOAD_PROFILE" }
  | { type: "SAVE_PROFILE" }
  | { type: "UPDATE_PROFILE" }
  | { type: "CANCEL_PROFILE_EDIT"; key: string }
  | { type: "DEACTIVATE_ACCOUNT" }
  | { type: "UPDATE_FORM"; key: string; value: any }
  | { type: "INIT_PROFILE_PAGE" }
  | { type: "CLEAR_ERROR" };

export const profileMachine = createMachine({
  id: "profile",
  initial: "idle",
  context: ProfileMachineDefaultContext,
  types: {
    context: {} as ProfileMachineContext,
    events: {} as ProfileMachineEvent,
  },
  states: {
    idle: {
      on: {
        SET_AUTH: {
          actions: assign({
            accessToken: ({ event }) => event.accessToken,
            userId: ({ event }) => event.userId,
          }),
        },
        LOGOUT: {
          actions: assign(() => ({
            ...ProfileMachineDefaultContext,
          })),
        },
        LOAD_PROFILE: {
          target: "savingProfile",
          guard: ({ context }) => !!context.accessToken && !!context.userId,
        },
        SAVE_PROFILE: {
          target: "savingProfile", 
          guard: ({ context }) => !!context.accessToken && !!context.userId,
        },
        UPDATE_PROFILE: {
          target: "updatingProfile",
          guard: ({ context }) =>
            !!context.accessToken &&
            !!context.userId &&
            !Object.values(context.formErrors || {}).some((error) => error && error.length > 0),
        },
        DEACTIVATE_ACCOUNT: {
          target: "deactivatingAccount",
          guard: ({ context }) => !!context.accessToken,
        },
        UPDATE_FORM: {
          actions: assign(({ context, event }) => {
            const updatedFormValues = {
              ...context.formValues,
              [event.key]: event.value,
            };

            const syntheticContext = buildValidationContext(context, updatedFormValues);
            const fieldError = validateField(event.key, event.value, syntheticContext);

            return {
              formValues: updatedFormValues,
              formErrors: {
                ...context.formErrors,
                [event.key]: fieldError,
              },
            };
          }),
        },
        CANCEL_PROFILE_EDIT: {
          actions: assign(({ context, event }) => {
            if (!context.profile) return {};
            const originalValue = (context.profile as unknown as Record<string, unknown>)[event.key];
            const valueToRestore = originalValue === undefined ? "" : originalValue;
            return {
              formValues: {
                ...context.formValues,
                [event.key]: valueToRestore,
              },
              formErrors: {
                ...context.formErrors,
                [event.key]: "",
              },
            };
          }),
        },
        CLEAR_ERROR: {
          actions: assign({
            error: null,
          }),
        },
      },
    },

    savingProfile: {
      entry: assign({
        loading: true,
        error: null,
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string; userId: string } }) => {
          return await loadProfile(input);
        }),
        input: ({ context }) => ({
          accessToken: context.accessToken!,
          userId: context.userId!,
        }),
        onDone: {
          target: "idle",
          actions: assign({
            profile: ({ event }) => event.output,
            loading: false,
            formValues: ({ event }) => {
              const profile = event.output as ProfileResponse;
              return {
                name: profile.name || "",
                surname: profile.surname || "",
                email: profile.email || "",
                phone: profile.phone || "",
                dni: profile.dni || "",
                gender: profile.gender || "",
                birthdate: profile.birthdate || null,
                specialty: profile.specialty || null,
                medicalLicense: profile.medicalLicense || null,
                slotDurationMin: profile.slotDurationMin || null,
              };
            },
            formErrors: () => ({}),
          }),
        },
        onError: {
          target: "idle",
          actions: assign({
            loading: false,
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Error al cargar el perfil",
          }),
        },
      },
    },

    updatingProfile: {
      entry: assign({
        updatingProfile: true,
        error: null,
      }),
      invoke: {
        src: fromPromise(async ({ input }: { 
          input: { 
            accessToken: string; 
            userId: string; 
            formValues: ProfileMachineContext['formValues'] 
          } 
        }) => {
          // Build update data from formValues
          const updateData: any = {};
          
          Object.keys(input.formValues).forEach(key => {
            const value = input.formValues[key as keyof typeof input.formValues];
            if (value !== null && value !== undefined && value !== "") {
              updateData[key] = value;
            }
          });

          return await updateProfile({
            accessToken: input.accessToken,
            userId: input.userId,
            formValues: input.formValues
          });
        }),
        input: ({ context }) => ({
          accessToken: context.accessToken!,
          userId: context.userId!,
          formValues: context.formValues,
        }),
        onDone: {
          target: "idle",
          actions: [
            assign({
              profile: ({ event }) => event.output,
              updatingProfile: false,
              formValues: ({ event }) => {
                const profile = event.output as ProfileResponse;
                return {
                  name: profile.name || "",
                  surname: profile.surname || "",
                  email: profile.email || "",
                  phone: profile.phone || "",
                  dni: profile.dni || "",
                  gender: profile.gender || "",
                  birthdate: profile.birthdate || null,
                  specialty: profile.specialty || null,
                  medicalLicense: profile.medicalLicense || null,
                  slotDurationMin: profile.slotDurationMin || null,
                };
              },
              formErrors: () => ({}),
            }),
            () => {
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: "Perfil actualizado exitosamente",
                severity: "success"
              });
            }
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              updatingProfile: false,
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : "Error al actualizar el perfil",
            }),
            ({ event }) => {
              const errorMessage = event.error instanceof Error ? event.error.message : "Error al actualizar el perfil";
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

    deactivatingAccount: {
      entry: assign({
        loading: true,
        error: null,
      }),
      invoke: {
        src: fromPromise(async ({ input }: { input: { accessToken: string } }) => {
          await deactivateAccount(input);
          return { success: true };
        }),
        input: ({ context }) => ({
          accessToken: context.accessToken!,
        }),
        onDone: {
          target: "idle",
          actions: [
            assign(() => {
              return {
                ...ProfileMachineDefaultContext,
              };
            }),
            () => {
              orchestrator.send({ type: "LOGOUT" });
              orchestrator.sendToMachine(UI_MACHINE_ID, {
                type: "OPEN_SNACKBAR",
                message: "Cuenta desactivada exitosamente",
                severity: "success"
              });
            }
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              loading: false,
              error: ({ event }) => (event.error as Error).message,
            }),
            ({ event }) => {
              const errorMessage = (event.error as Error).message || "Error al desactivar la cuenta";
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
        userId: null,
      }),
    },
    INIT_PROFILE_PAGE: {
      actions: ({ context, self }) => {
        if (context.accessToken && context.userId) {
          self.send({ type: "LOAD_PROFILE" });
        }
      },
    },
  },
});