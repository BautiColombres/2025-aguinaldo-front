import { createMachine, assign, fromPromise } from "xstate";
import {validateField, checkFormValidation} from "../utils/authFormValidation";
import { checkStoredAuth, submitAuthentication, logoutUser } from "../utils/MachineUtils/authMachineUtils";
import { AuthService } from "../service/auth-service.service";
import { RegisterResponse, SignInResponse, ApiErrorResponse } from "../models/Auth";
import { orchestrator } from "#/core/Orchestrator";

export const AUTH_MACHINE_ID = "auth";
export const AUTH_MACHINE_EVENT_TYPES = [
  'USER_AUTHENTICATED',
  'LOGOUT',
  'UPDATE_FORM',
  'TOGGLE_USER_TYPE',
  'TOGGLE_MODE',
  'SUBMIT',
  'CHECK_AUTH',
  // FBUG-003 — broadcast by the centralized `authenticatedFetch` interceptor
  // (config/api) after a silent token refresh / on a definitive session loss.
  'TOKEN_REFRESHED',
  'SESSION_EXPIRED'
];

export interface AuthMachineContext {
  mode: "login" | "register";
  isPatient: boolean;
  hasErrorsOrEmpty: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  loggingOut: boolean; 
  verificationToken?: string | null;
  verificationStatus?: 'idle' | 'success' | 'error';
  verificationMessage?: string;
  formValues: {
    // Login fields
    email: string;
    password: string;
    // Register fields
    name: string;
    surname: string;
    dni: string;
    gender: string;
    birthdate: string | null;
    password_confirm: string;
    phone: string;
    specialty: string | null;
    medicalLicense: string | null;
    slotDurationMin?: number | null;
  };
  formErrors?: {
    [key: string]: string;
  };
  authResponse?: RegisterResponse | SignInResponse | ApiErrorResponse | null;
  send: (event: any) => void;
}

export const AuthMachineDefaultContext = {
    mode: "login",
    isPatient: true,
    hasErrorsOrEmpty: true,
    isAuthenticated: false,
    loading: false,
    loggingOut: false,
    verificationToken: null,
    verificationStatus: 'idle',
    verificationMessage: '',
    formValues: {
      email: "",
      password: "",
      name: "", 
      surname: "", 
      dni: "", 
      gender: "", 
      birthdate: null, 
      password_confirm: "", 
      phone: "", 
      specialty: null, 
      medicalLicense: null, 
      slotDurationMin: null
    },
    formErrors: {},
    authResponse: null,
    send: (event: any) => { orchestrator.send(event);}
  } as AuthMachineContext;

export type AuthMachineEvent =
  | { type: "UPDATE_FORM"; key: string; value: any }
  | { type: "TOGGLE_USER_TYPE"; isPatient: boolean }
  | { type: "TOGGLE_MODE"; mode: "login" | "register" }
  | { type: "SUBMIT" }
  | { type: "LOGOUT" }
  | { type: "CHECK_AUTH" }
  // FBUG-003 — emitted by the `authenticatedFetch` interceptor after it silently
  // refreshed the access token (401 → refresh → retry).
  | { type: "TOKEN_REFRESHED"; accessToken: string }
  // FBUG-003 — emitted by the interceptor when the refresh failed (or the retry
  // still 401'd): the session is gone for good.
  | { type: "SESSION_EXPIRED" };


export const authMachine = createMachine({
  id: "auth",
  initial: "checkingAuth",
  context: AuthMachineDefaultContext,
  types: {
    context: {} as AuthMachineContext,
    events: {} as AuthMachineEvent,
  },
  on: {
    // The interceptor already refreshed and retried the request; the machine just
    // adopts the new access token so components reading `authResponse.accessToken`
    // stop handing out the stale one. Guarded so a stray broadcast cannot
    // resurrect a logged-out session.
    TOKEN_REFRESHED: {
      guard: ({ context }) => context.isAuthenticated && !!context.authResponse,
      actions: assign(({ context, event }) => {
        const current = context.authResponse as SignInResponse;
        if (!current || current.accessToken === event.accessToken) {
          return {};
        }
        return {
          authResponse: { ...current, accessToken: event.accessToken },
        };
      })
    },
    // Definitive session loss: clear the in-memory auth, warn and send to login.
    // Guarded on `isAuthenticated` so concurrent failures cannot stack snackbars.
    SESSION_EXPIRED: {
      guard: ({ context }) => context.isAuthenticated,
      target: ".idle",
      actions: [
        assign(() => ({
          isAuthenticated: false,
          authResponse: null
        })),
        () => {
          orchestrator.send({ type: "CLEAR_ACCESS_TOKEN" });
          orchestrator.send({ type: "NAVIGATE", to: "/" });
          orchestrator.send({
            type: "OPEN_SNACKBAR",
            message: "Sesión expirada. Por favor, vuelve a iniciar sesión.",
            severity: "error"
          });
        }
      ]
    }
  },
  states: {
    checkingAuth: {
      invoke: {
        src: fromPromise(async () => {
          return await checkStoredAuth();
        }),
        onDone: [
          {
            target: "authenticated",
            guard: ({ event }) => event.output.isAuthenticated,
            actions: assign(({ event }) => ({
              authResponse: event.output.authData,
              isAuthenticated: event.output.isAuthenticated
            }))
          },
          {
            target: "checkingVerification",
            actions: [
              assign(({ event }) => ({
                authResponse: event.output.authData,
                isAuthenticated: event.output.isAuthenticated
              })),
              ({ event }) => {
                // If we had auth data but token validation failed, show message and navigate
                if (event.output.authData && !event.output.isAuthenticated) {
                  orchestrator.send({ type: "CLEAR_ACCESS_TOKEN" });
                  orchestrator.send({ type: "NAVIGATE", to: "/" });
                  orchestrator.send({ 
                    type: "OPEN_SNACKBAR", 
                    message: "Sesión expirada. Por favor, vuelve a iniciar sesión.", 
                    severity: "warning" 
                  });
                }
              }
            ]
          }
        ],
        onError: {
          target: "checkingVerification",
          actions: [
            assign(() => ({
              authResponse: null,
              isAuthenticated: false
            })),
            () => {
              // Navigate to login when auth check fails
              orchestrator.send({ type: "CLEAR_ACCESS_TOKEN" });
              orchestrator.send({ type: "NAVIGATE", to: "/" });
              orchestrator.send({ 
                type: "OPEN_SNACKBAR", 
                message: "Sesión expirada. Por favor, vuelve a iniciar sesión.", 
                severity: "warning" 
              });
            }
          ]
        }
      }
    },
    authenticated: {
      on: {
        LOGOUT: {
          target: "loggingOut"
        }
      },
      entry: ({ context }) => {
        if (context.authResponse && "accessToken" in context.authResponse) {

          setTimeout(() => {
            const response = context.authResponse as SignInResponse;
            if (response.status!=='ACTIVE'){
              orchestrator.send({ 
                type: "NAVIGATE", to: "/pending-activation"});
            }
            else{
            orchestrator.send({ 
              type: "SET_AUTH", 
              accessToken: response.accessToken, 
              userId: response.id,
              userRole: response.role
            });}
          }, 0);
        }
      }
    },

    loggingOut: {
      // Set loggingOut flag to true when entering this state
      entry: assign(() => ({
        loggingOut: true
      })),
      invoke: {
        src: fromPromise(async () => {
          return await logoutUser();
        }),
        input: ({ context }) => context,
        onDone: {
          target: "idle",
          actions: [assign(() => ({
            isAuthenticated: false,
            authResponse: null,
            loggingOut: false // Reset loggingOut flag
          })),
          () => {
            orchestrator.send({ type: "CLEAR_ACCESS_TOKEN" });
            orchestrator.send({ type: "NAVIGATE", to: "/" });
          }
          ],
        },
        onError: {
          target: "idle",
          actions: [assign(() => ({
            isAuthenticated: false,
            authResponse: null,
            loggingOut: false // Reset loggingOut flag even on error
          })),
          () => {
            orchestrator.send({ type: "CLEAR_ACCESS_TOKEN" });
            orchestrator.send({ type: "NAVIGATE", to: "/" });
          }
          ],
        }
      }
    },
    idle: {
      on: {
        UPDATE_FORM: {
          actions: assign(({ context, event }) => {
            const updatedFormValues = {
              ...context.formValues,
              [event.key]: event.value
            };

            const updatedFormErrors = {
              ...context.formErrors,
              [event.key]: validateField(event.key, event.value, context)
            };

            const updatedContext = {
              ...context,
              formValues: updatedFormValues,
              formErrors: updatedFormErrors
            };

            const hasErrorsOrEmpty = checkFormValidation(updatedContext);

            return {
              formValues: updatedFormValues,
              formErrors: updatedFormErrors,
              hasErrorsOrEmpty
            };
          })
        },
        TOGGLE_USER_TYPE: {
          actions: assign(({ context, event }) => {
            const updatedContext = {
              ...context,
              isPatient: event.isPatient
            };

            const hasErrorsOrEmpty = checkFormValidation(updatedContext);

            return {
              isPatient: event.isPatient,
              hasErrorsOrEmpty
            };
          })
        },
        TOGGLE_MODE: {
          actions: assign(({ context, event }) => {
            // Preserve form values when switching modes, only clear errors and loading state
            return {
              mode: event.mode,
              hasErrorsOrEmpty: true,
              formErrors: {},
              authResponse: null,
              loading: false,
              // Keep form values to preserve user input
              formValues: context.formValues
            };
          })
        },
        SUBMIT: { 
          target: "validating" 
        }
      }
    },
    checkingVerification: {
      entry: assign(() => {
        const params = new URLSearchParams(window.location.search);
        return {
          verificationToken: params.get('token')
        };
      }),
      always : [
        {
          target: "verifyingEmail",
          guard: ({context}) => !!context.verificationToken
        },
        {
          target: "idle"
        }
      ]
    },
    verifyingEmail: {
      entry: () => {
        window.history.replaceState({}, document.title, window.location.pathname);
      },
      invoke: {
        src: fromPromise(async ({ input }: { input: { token: string } }) => {
            return await AuthService.verifyAccount(input.token);
        }),
        input: ({ context }) => ({ token: context.verificationToken! }),
        onDone: {
          target: "idle", 
          actions: assign(({ event }) => {
            const output = event.output as { message: string };
            
            const update: Partial<AuthMachineContext> = {
                verificationStatus: 'success',
                verificationMessage: output.message || 'Cuenta verificada correctamente. Por favor inicia sesión.',
                verificationToken: null 
            };
            return update;
          })
        },
        onError: {
          target: "idle",
          actions: assign(({ event }) => {
            const update: Partial<AuthMachineContext> = {
                verificationStatus: 'error',
                verificationMessage: (event.error as Error).message || 'El enlace de verificación es inválido o ha expirado.',
                verificationToken: null
            };
            return update;
          })
        }
      }
    },
    validating: {
      always: [
        {
          target: "submitting",
          guard: ({ context }) => {
            const errors: Record<string, string> = {};
            
            for (const [key, value] of Object.entries(context.formValues || {})) {
              if ((context.isPatient && key.startsWith("user")) || 
                  (!context.isPatient && (key.startsWith("user") || key.startsWith("doctor")))) {
                const error = validateField(key, value, context);
                if (error) errors[key] = error;
              }
            }

            return Object.keys(errors).length === 0;
          },
          actions: assign({
            formErrors: ({ context }) => {
              const errors: Record<string, string> = {};
              for (const [key, value] of Object.entries(context.formValues || {})) {
                if ((context.isPatient && key.startsWith("user")) || 
                    (!context.isPatient && (key.startsWith("user") || key.startsWith("doctor")))) {
                  const error = validateField(key, value, context);
                  if (error) errors[key] = error;
                }
              }
              return errors;
            },
            hasErrorsOrEmpty: ({ context }) => {
              const errors: Record<string, string> = {};
              for (const [key, value] of Object.entries(context.formValues || {})) {
                if ((context.isPatient && key.startsWith("user")) || 
                    (!context.isPatient && (key.startsWith("user") || key.startsWith("doctor")))) {
                  const error = validateField(key, value, context);
                  if (error) errors[key] = error;
                }
              }
              const updatedContext = { ...context, formErrors: errors };
              return checkFormValidation(updatedContext);
            }
          })
        },
        { 
          target: "idle",
          actions: assign({
            hasErrorsOrEmpty: ({ context }) => {
              return checkFormValidation(context);
            }
          })
        }
      ]
    },
    submitting: {
      entry: assign(() => ({
        loading: true
      })),
      invoke: {
        src: fromPromise(async ({ input }: { input: AuthMachineContext }) => {
          return await submitAuthentication({ context: input });
        }),
        input: ({context}) => context,
        onDone: [
          {
            target: "authenticated",
            guard: ({ context }) => context.mode === "login",
            actions: assign(({ event }) => {
              const response = event.output;

              return {
                isAuthenticated: true,
                authResponse: response,
                formValues: { ...AuthMachineDefaultContext.formValues },
                formErrors: {},
                hasErrorsOrEmpty: true,
                loading: false
              };
            })
          },
          {
            target: "idle",
            guard: ({ context }) => context.mode === "register",
            actions: assign(({ event, context }): AuthMachineContext => {
              const response = event.output;
              
              return {
                ...context,
                mode: "login",
                formValues: {
                  ...AuthMachineDefaultContext.formValues,
                  email: context.formValues.email,
                },
                authResponse: {
                  ...response,
                  message: "Registro exitoso. Por favor, revise su casilla de correo para verificar su cuenta"
                },
                formErrors: {},
                hasErrorsOrEmpty: false,
                isAuthenticated: false,
                loading: false
              };
            })
          }
        ],
        onError: {
          target: "idle",
          actions: assign(({ event, context }): Partial<AuthMachineContext> => {
            const error = event.error;

            // Handle validation errors from backend
            if (error && (error as { fieldErrors?: Record<string, string> }).fieldErrors) {
              const fieldErrors = (error as { fieldErrors: Record<string, string> }).fieldErrors;
              const validationResponse: ApiErrorResponse = {
                error: 'Por favor revise los campos marcados con error',
                message: 'Por favor revise los campos marcados con error',
              };
              return {
                formErrors: {
                  ...context.formErrors,
                  ...fieldErrors,
                },
                authResponse: validationResponse,
                loading: false,
              };
            }

            // Handle general errors
            const message = error instanceof Error ? error.message : 'Error en autenticación';
            const status = (error as { status?: number } | null)?.status;
            const generalResponse: ApiErrorResponse = {
              error: message,
              message,
              ...(typeof status === 'number' ? { status } : {}),
            };
            return {
              authResponse: generalResponse,
              loading: false,
            };
          })
        }
      }
    }
  }
});