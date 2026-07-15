import { createMachine, assign, fromPromise } from "xstate";
import { saveDoctorAvailability, updateMedicalHistory, loadDoctorMetrics } from "../utils/MachineUtils/doctorMachineUtils";
import { orchestrator } from "#/core/Orchestrator";
import { DATA_MACHINE_ID } from "./dataMachine";
import { UI_MACHINE_ID } from "./uiMachine";
import { MEDICAL_HISTORY_MACHINE_ID } from "./medicalHistoryMachine";
import type { Patient } from "../models/Doctor";
import type { DoctorMetrics } from "../service/doctor-service.service";
// FBUG-003 — classify by kind instead of sniffing the raw body/message: the backend
// now returns a JSON body for 403 ({"error":"FORBIDDEN","message":"Access denied"}),
// so a `message.includes('403')` check no longer matches.
import { API_ERROR_MESSAGES, classifyApiError } from "../../config/api";

export const DOCTOR_MACHINE_ID = "doctor";
export const DOCTOR_MACHINE_EVENT_TYPES = [
  // FBUG-003 / FSEC — silent token refresh + credential wipe on logout & expiry.
  'TOKEN_REFRESHED',
  'CLEAR_ACCESS_TOKEN',
  "SET_AUTH",
  "RESET",
  "TOGGLE_DAY",
  "ADD_RANGE",
  "REMOVE_RANGE",
  "UPDATE_RANGE",
  "SAVE_AVAILABILITY",
  "SET_PATIENT_SEARCH",
  "SELECT_PATIENT",
  "CLEAR_PATIENT_SELECTION",
  "START_EDIT_HISTORY",
  "UPDATE_HISTORY",
  "SAVE_HISTORY",
  "PATIENTS_LOADED",
  "DATA_LOADED",
  "LOAD_METRICS",
  "RELOAD_METRICS"
];

interface Range {
  start: string;
  end: string;
}

interface DayAvailability {
  day: string;
  enabled: boolean;
  ranges: Range[];
}

export interface DoctorMachineContext {
  accessToken: string | null;
  doctorId: string | null;
  patientSearchTerm: string;
  
  patients: Patient[];
  selectedPatient: Patient | null;
  selectedPatientId: string | null;
  editedHistory: string;
  isSavingHistory: boolean;
  currentTurnId: string | null; // For associating medical history with a turn
  patientSelectionAttempts: number; // Track attempts to find patient
  
  availability: DayAvailability[];
  slotDurationMin: number | null;
  isSavingAvailability: boolean;
  isLoadingAvailability: boolean;
  availabilityError: string | null;
  
  metrics: DoctorMetrics | null;
  isLoadingMetrics: boolean;
  metricsError: string | null;
}

export type DoctorMachineEvent =
  | { type: "SET_AUTH"; accessToken: string; userId: string; userRole?: string }
  | { type: "RESET" }
  | { type: "TOGGLE_DAY"; index: number }
  | { type: "ADD_RANGE"; dayIndex: number }
  | { type: "REMOVE_RANGE"; dayIndex: number; rangeIndex: number }
  | { type: "UPDATE_RANGE"; dayIndex: number; rangeIndex: number; field: "start" | "end"; value: string }
  | { type: "SAVE_AVAILABILITY" }
  | { type: "SET_PATIENT_SEARCH"; searchTerm: string }
  | { type: "SELECT_PATIENT"; patientId: string }
  | { type: "CLEAR_PATIENT_SELECTION" }
  | { type: "START_EDIT_HISTORY" }
  | { type: "UPDATE_HISTORY"; value: string }
  | { type: "SAVE_HISTORY"; turnId?: string }
  | { type: "PATIENTS_LOADED" }
  | { type: "DATA_LOADED" }
  | { type: "LOAD_METRICS" }
  | { type: "RELOAD_METRICS" };

const doctorMachine = createMachine({
  id: "doctor",
  type: "parallel",

  context: {
    accessToken: null,
    doctorId: null,
    patientSearchTerm: "",
    
    patients: [],
    selectedPatient: null,
    selectedPatientId: null,
    editedHistory: '',
    isSavingHistory: false,
    currentTurnId: null,
    patientSelectionAttempts: 0,
    availability: [
      { day: "Lunes", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Martes", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Miércoles", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Jueves", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Viernes", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Sábado", enabled: false, ranges: [{ start: "", end: "" }] },
      { day: "Domingo", enabled: false, ranges: [{ start: "", end: "" }] },
    ],
    slotDurationMin: null,
    isSavingAvailability: false,
    isLoadingAvailability: false,
    availabilityError: null,
    metrics: null,
    isLoadingMetrics: false,
    metricsError: null,
  } as DoctorMachineContext,

  states: {
    patientManagement: {
      initial: "idle",
      states: {
        idle: {
          on: {
            RESET: {
              actions: assign({
                selectedPatient: null,
                selectedPatientId: null,
                editedHistory: '',
                isSavingHistory: false,
              }),
            },
            SELECT_PATIENT: {
              actions: assign({
                selectedPatientId: ({ event }) => event.patientId,
                patientSelectionAttempts: 0, // Reset attempts when selecting new patient
              }),
              target: "selectingPatient",
            },
            CLEAR_PATIENT_SELECTION: {
              actions: [assign({
                selectedPatient: null,
                selectedPatientId: null,
                editedHistory: '',
                isSavingHistory: false,
              }),
              () => {
                orchestrator.send({ type: "NAVIGATE", to: "/doctor/view-patients" });
              }],
            },
            START_EDIT_HISTORY: {
              actions: [assign({
                editedHistory: ({ context }) => context.selectedPatient?.medicalHistory || '',
              })],
            },
            UPDATE_HISTORY: {
              actions: assign({
                editedHistory: ({ event }) => event.value,
              }),
            },
            SAVE_HISTORY: {
              actions: assign({
                currentTurnId: ({ event }) => event.type === 'SAVE_HISTORY' && 'turnId' in event ? event.turnId || null : null,
              }),
              target: "savingHistory",
            },
            PATIENTS_LOADED: {
              guard: ({ context }) => {
                const hasId = !!context.selectedPatientId;
                const hasPatient = !!context.selectedPatient;
                return hasId && !hasPatient;
              },
              target: "selectingPatient",
            },
          },
        },
        
        selectingPatient: {
          entry: [
            ({ context }) => {
              if (context.accessToken && context.selectedPatientId) {
                orchestrator.sendToMachine(MEDICAL_HISTORY_MACHINE_ID, {
                  type: "LOAD_PATIENT_MEDICAL_HISTORY",
                  patientId: context.selectedPatientId,
                  accessToken: context.accessToken,
                  doctorId: context.doctorId,
                });
                orchestrator.sendToMachine(DATA_MACHINE_ID, {
                  type: "LOAD_MY_TURNS"
                });
              }
            },
            assign({
              selectedPatient: ({ context }) => {
                try {
                  const dataSnapshot = orchestrator.getSnapshot(DATA_MACHINE_ID);
                  const dataContext = dataSnapshot.context;
                  const patients = dataContext.doctorPatients || [];
                  const patient = patients.find((p: any) => p.id === context.selectedPatientId);
                  return patient || null;
                } catch (error) {
                  console.error('Error finding patient by ID:', error);
                  return null;
                }
              },
              patientSelectionAttempts: ({ context }) => context.patientSelectionAttempts + 1,
            }),
            ({ context }) => {
              if (context.selectedPatient) {
                orchestrator.send({ type: "NAVIGATE", to: `/patient-detail?patientId=${context.selectedPatient.id}` });
              } else if (context.patientSelectionAttempts >= 2) {
                // Patient not found after data loaded, show error and navigate away
                orchestrator.sendToMachine(UI_MACHINE_ID, { 
                  type: "OPEN_SNACKBAR", 
                  message: "Paciente no encontrado", 
                  severity: "error" 
                });
                orchestrator.send({ type: "NAVIGATE", to: "/doctor/view-patients" });
              }
            }
          ],
          always: [
            {
              guard: ({ context }) => !!context.selectedPatient || context.patientSelectionAttempts >= 2,
              target: "idle",
              actions: assign({
                selectedPatientId: ({ context }) => context.selectedPatient ? context.selectedPatientId : null,
                patientSelectionAttempts: 0,
              })
            }
          ],
          on: {
            PATIENTS_LOADED: {
              target: "selectingPatient",
              reenter: true
            }
          }
        },
        
        savingHistory: {
          entry: assign({
            isSavingHistory: true,
          }),
          
          invoke: {
            src: fromPromise(async ({ input }: { 
              input: { 
                accessToken: string; 
                doctorId: string; 
                patientId: string; 
                medicalHistory: string; 
              } 
            }) => {
              return await updateMedicalHistory(input);
            }),

            input: ({ context }) => ({
              accessToken: context.accessToken!,
              doctorId: context.doctorId!,
              patientId: context.selectedPatient!.id,
              medicalHistory: context.editedHistory,
              turnId: context.currentTurnId || undefined
            }),

            onDone: {
              target: "idle",
              actions: [
                assign({
                  isSavingHistory: false,
                  editedHistory: '',
                  currentTurnId: null, // Reset the turnId after saving
                  selectedPatient: ({ context }) => 
                    context.selectedPatient 
                      ? { ...context.selectedPatient, medicalHistory: context.editedHistory }
                      : null,
                }),
                () => {

                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Historial médico actualizado exitosamente", 
                    severity: "success" 
                  });

   
                  orchestrator.sendToMachine(DATA_MACHINE_ID, {
                    type: "RETRY_DOCTOR_PATIENTS"
                  });
                }
              ]
            },
            
            onError: {
              target: "idle",
              actions: [
                assign({
                  isSavingHistory: false,
                }),
                ({ event }) => {
                  const error = event.error as Error;
                  let errorMessage = "Error al actualizar el historial médico. Inténtalo de nuevo.";
                  
                  if (error?.message?.includes('Failed to fetch') || error?.message?.includes('fetch')) {
                    errorMessage = "No se pudo conectar con el servidor. Verifica tu conexión.";
                  } else if (error?.message?.includes('404')) {
                    errorMessage = "Paciente no encontrado.";
                  } else if (classifyApiError(error).kind === 'forbidden') {
                    // A 403 is a permission denial (e.g. a PENDING doctor), NOT an expiry.
                    errorMessage = API_ERROR_MESSAGES.forbidden;
                  } else if (classifyApiError(error).kind === 'unauthorized') {
                    errorMessage = "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
                  } else if (error?.message) {
                    errorMessage = error.message;
                  }
                  
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: errorMessage, 
                    severity: "error" 
                  });
                }
              ]
            },
          },
        },
      },
    },

    availability: {
      initial: "idle",
      states: {
        idle: {
          on: {
            TOGGLE_DAY: {
              actions: assign({
                availability: ({ context, event }) =>
                  context.availability.map((d, i) =>
                    i === event.index ? { ...d, enabled: !d.enabled } : d
                  ),
              }),
            },
            ADD_RANGE: {
              actions: assign({
                availability: ({ context, event }) =>
                  context.availability.map((d, i) =>
                    i === event.dayIndex
                      ? { ...d, ranges: [...d.ranges, { start: "", end: "" }] }
                      : d
                  ),
              }),
            },
            REMOVE_RANGE: {
              actions: assign({
                availability: ({ context, event }) =>
                  context.availability.map((d, i) =>
                    i === event.dayIndex
                      ? {
                          ...d,
                          ranges: d.ranges.filter((_, r) => r !== event.rangeIndex),
                        }
                      : d
                  ),
              }),
            },
            UPDATE_RANGE: {
              actions: assign({
                availability: ({ context, event }) =>
                  context.availability.map((d, i) =>
                    i === event.dayIndex
                      ? {
                          ...d,
                          ranges: d.ranges.map((r, ri) =>
                            ri === event.rangeIndex
                              ? { ...r, [event.field]: event.value }
                              : r
                          ),
                        }
                      : d
                  ),
              }),
            },
            SAVE_AVAILABILITY: "saving",
          },
        },
        
        saving: {
          entry: assign({
            isSavingAvailability: true,
            availabilityError: null
          }),
          
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string; availability: DayAvailability[] } }) => {
              return await saveDoctorAvailability(input);
            }),

            input: ({ context }) => ({
              accessToken: context.accessToken!,
              doctorId: context.doctorId!,
              availability: context.availability
            }),

            onDone: { 
              target: "idle",
              actions: [
                assign({
                  availabilityError: () => null,
                  isSavingAvailability: false
                }),
                () => {
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Disponibilidad guardada exitosamente", 
                    severity: "success" 
                  });
                }
              ]
            },
            onError: { 
              target: "idle",
              actions: [
                assign({
                  availabilityError: ({ event }) => {
                    const error = event.error as Error;
                    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('fetch')) {
                      return "No se pudo conectar con el servidor. Verifica tu conexión.";
                    }
                    if (error?.message?.includes('404')) {
                      return "Servicio no disponible. Inténtalo más tarde.";
                    }
                    if (classifyApiError(error).kind === 'forbidden') {
                      return API_ERROR_MESSAGES.forbidden;
                    }
                    if (classifyApiError(error).kind === 'unauthorized') {
                      return "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
                    }
                    return error?.message || "Error al guardar la disponibilidad. Inténtalo de nuevo.";
                  },
                  isSavingAvailability: false
                }),
                ({ event }) => {
                  const error = event.error as Error;
                  const errorMessage = error?.message || "Error al guardar la disponibilidad. Inténtalo de nuevo.";
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: errorMessage, 
                    severity: "error" 
                  });
                }
              ]
            },
          },
        },
      },
    },

    metrics: {
      initial: "idle",
      states: {
        idle: {
          on: {
            LOAD_METRICS: "loading",
            RELOAD_METRICS: "loading",
          },
        },
        loading: {
          entry: assign({
            isLoadingMetrics: true,
            metricsError: null,
          }),
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; doctorId: string } }) => {
              return await loadDoctorMetrics(input);
            }),
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              doctorId: context.doctorId!,
            }),
            onDone: {
              target: "idle",
              actions: assign({
                metrics: ({ event }) => event.output,
                isLoadingMetrics: false,
                metricsError: null,
              }),
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isLoadingMetrics: false,
                  metricsError: ({ event }) => {
                    const error = event.error as Error;
                    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('fetch')) {
                      return "No se pudo conectar con el servidor. Verifica tu conexión.";
                    }
                    if (error?.message?.includes('404')) {
                      return "Métricas no disponibles.";
                    }
                    if (classifyApiError(error).kind === 'forbidden') {
                      return API_ERROR_MESSAGES.forbidden;
                    }
                    if (classifyApiError(error).kind === 'unauthorized') {
                      return "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
                    }
                    return error?.message || "Error al cargar las métricas. Inténtalo de nuevo.";
                  },
                }),
                ({ event }) => {
                  const error = event.error as Error;
                  const errorMessage = error?.message || "Error al cargar las métricas. Inténtalo de nuevo.";
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
        doctorId: null,
      }),
    },
    SET_AUTH: {
      actions: assign({
        accessToken: ({ event }) => event.accessToken,
        doctorId: ({ event }) => event.userId, 
      }),
    },
    SET_PATIENT_SEARCH: {
      actions: assign({
        patientSearchTerm: ({ event }) => event.searchTerm,
      }),
    },
    DATA_LOADED: {
      actions: [
        assign(() => {
          try {
            const dataSnapshot = orchestrator.getSnapshot(DATA_MACHINE_ID);
            const dataContext = dataSnapshot.context;
            
            const dayMapping: { [key: string]: string } = {
              "MONDAY": "Lunes",
              "TUESDAY": "Martes", 
              "WEDNESDAY": "Miércoles",
              "THURSDAY": "Jueves",
              "FRIDAY": "Viernes",
              "SATURDAY": "Sábado",
              "SUNDAY": "Domingo"
            };
            
            const availabilityData = dataContext.doctorAvailability as any;
            if (availabilityData && availabilityData.weeklyAvailability && availabilityData.weeklyAvailability.length > 0) {
              return {
                availability: availabilityData.weeklyAvailability.map((day: any) => ({
                  day: dayMapping[day.day] || day.day,
                  enabled: day.enabled,
                  ranges: day.ranges || [{ start: "", end: "" }]
                })),
                slotDurationMin: availabilityData.slotDurationMin,
                patients: dataContext.doctorPatients || [],
                isLoadingAvailability: false,
                availabilityError: null,
              };
            }
            
            return {
              patients: dataContext.doctorPatients || [],
              slotDurationMin: null,
              isLoadingAvailability: false,
              availabilityError: null,
              availability: [
                { day: "Lunes", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Martes", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Miércoles", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Jueves", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Viernes", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Sábado", enabled: false, ranges: [{ start: "", end: "" }] },
                { day: "Domingo", enabled: false, ranges: [{ start: "", end: "" }] },
              ],
            };
          } catch (error) {
            console.warn("Could not get dataMachine snapshot:", error);
            return {};
          }
        }),
        ({ self }) => {
          self.send({ type: "PATIENTS_LOADED" });
        }
      ],
    },
  },
});

export default doctorMachine;