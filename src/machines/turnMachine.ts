import { createMachine, assign, fromPromise } from "xstate";
import dayjs from "../utils/dayjs.config";
import { Dayjs } from "dayjs";
import { createTurn, cancelTurn, completeTurn, noShowTurn } from "../utils/MachineUtils/turnMachineUtils";
import { orchestrator } from "#/core/Orchestrator";
import type { Doctor, TurnResponse } from "../models/Turn";
import { DATA_MACHINE_ID } from "./dataMachine";
import { UI_MACHINE_ID } from "./uiMachine";
import { TurnService } from '../service/turn-service.service';
import { TurnModifyService } from "#/service/turn-modify-service.service";

export const TURN_MACHINE_ID = "turn";
export const TURN_MACHINE_EVENT_TYPES = [
  "UPDATE_FORM",
  "NEXT",
  "BACK",
  "RESET_TAKE_TURN",
  "RESET_SHOW_TURNS",
  "DATA_LOADED",
  "LOADING",
  "CREATE_TURN",
  "CANCEL_TURN",
  "COMPLETE_TURN",
  "NO_SHOW_TURN",
  "CLEAR_CANCEL_SUCCESS",
  "SUBMIT_MODIFY_REQUEST",
  "LOAD_MODIFY_AVAILABLE_SLOTS",
  "CHECK_DOCTOR_AVAILABILITY",
  "SET_AVAILABLE_SLOTS_LOADING",
  "NAVIGATE",
];

export interface TurnMachineContext {
  allDoctors: Doctor[];
  doctors: Doctor[];
  availableTurns: string[];
  availableDates: string[];
  myTurns: TurnResponse[];
  isLoadingMyTurns: boolean;
  isCreatingTurn: boolean;
  isCancellingTurn: boolean;
  cancellingTurnId: string | null;
  error: string | null;
  cancelSuccess: string | null;

  takeTurn: {
    professionSelected: string;
    profesionalSelected: string;
    doctorId: string;
    dateSelected: Dayjs | null;
    timeSelected: Dayjs | null;
    scheduledAt: string | null;
      motive: string;
      needsHealthCertificate: boolean;
  };

  showTurns: {
    dateSelected: Dayjs | null;
    statusFilter: string;
  };

  modifyTurn?: {
    turnId?: string | null;
    currentTurn?: TurnResponse | null;
    selectedDate?: Dayjs | null;
    selectedTime?: string | null;
    availableSlots?: string[];
    availableDates?: string[];
    motive?: string;
  };

  modifyError: string | null;
  accessToken: string | null;
  userId: string | null;
  doctorAvailability: Record<string, boolean>;
  isLoadingDoctors: boolean;
  specialties: { value: string; label: string }[];
  isLoadingAvailableDates: boolean;
  isLoadingAvailableSlots: boolean;
}

export type TurnMachineEvent =
  | { type: "UPDATE_FORM"; path: string[]; value: any }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "RESET_TAKE_TURN" }
  | { type: "RESET_SHOW_TURNS" }
  | { type: "DATA_LOADED" }
  | { type: "LOADING" }
  | { type: "CREATE_TURN" }
  | { type: "CANCEL_TURN"; turnId: string }
  | { type: "COMPLETE_TURN"; turnId: string }
  | { type: "NO_SHOW_TURN"; turnId: string }
  | { type: "CLEAR_CANCEL_SUCCESS" }
  | { type: "SUBMIT_MODIFY_REQUEST" }
  | { type: "LOAD_MODIFY_AVAILABLE_SLOTS"; doctorId: string; date: string }
  | { type: "RESET_MODIFY_TURN" }
  | { type: "CHECK_DOCTOR_AVAILABILITY" }
  | { type: "SET_AVAILABLE_SLOTS_LOADING"; isLoading: boolean }
  | { type: "NAVIGATE"; to: string | null };

export const normalizeSpecialtyKey = (value: string | null | undefined): string => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

export const formatSpecialtyLabel = (value: string): string => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const buildSpecialtyOptions = (doctors: Doctor[]): { value: string; label: string }[] => {
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];

  doctors.forEach((doctor) => {
    const specialty = doctor?.specialty;
    const key = normalizeSpecialtyKey(specialty);
    if (!key || seen.has(key) || !specialty) {
      return;
    }
    seen.add(key);
    options.push({ value: specialty, label: formatSpecialtyLabel(specialty) });
  });

  options.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return options;
};

export const buildDoctorAvailabilityMap = async (
  doctors: Doctor[],
  accessToken: string
): Promise<Record<string, boolean>> => {
  const availability: Record<string, boolean> = {};

  for (const doctor of doctors) {
    if (!doctor?.id) {
      continue;
    }
    try {
      const dates = await TurnService.getAvailableDates(doctor.id, accessToken);
      availability[doctor.id] = Array.isArray(dates) && dates.length > 0;
    } catch (error) {
      console.error(`[turnMachine] Failed to load availability for doctor ${doctor.id}`, error);
      availability[doctor.id] = false;
    }
  }

  return availability;
};

export const mapDataMachineSnapshotToContext = (currentContext: TurnMachineContext): Partial<TurnMachineContext> => {
  try {
    const dataSnapshot = orchestrator.getSnapshot(DATA_MACHINE_ID);
    const dataContext = dataSnapshot?.context ?? {};
    const loadingState = dataContext.loading ?? {};

    const authSnapshot = orchestrator.getSnapshot('auth');
    const authContext = authSnapshot?.context;

    const doctors = Array.isArray(dataContext.doctors) ? [...(dataContext.doctors as Doctor[])] : [];
    const accessToken = dataContext.accessToken || null;
    
    const prevDoctorsIds = new Set(currentContext.allDoctors.map((d) => d.id));
    let doctorsChanged = doctors.length !== currentContext.allDoctors.length;
    if (!doctorsChanged) {
        for (const d of doctors) {
            if (!prevDoctorsIds.has(d.id)) {
                doctorsChanged = true;
                break;
            }
        }
    }
    const hasAvailabilityData = Object.keys(currentContext.doctorAvailability).length > 0;
    
    const shouldCheckAvailability = !!accessToken && doctors.length > 0 && (doctorsChanged || !hasAvailabilityData);

    const nextDoctors = doctorsChanged
        ? (shouldCheckAvailability ? [] : doctors)
        : currentContext.doctors;

    const nextSpecialties = doctorsChanged
        ? (shouldCheckAvailability ? [] : buildSpecialtyOptions(doctors))
        : currentContext.specialties;
        
    const nextAvailability = doctorsChanged
        ? (shouldCheckAvailability ? {} : currentContext.doctorAvailability)
        : currentContext.doctorAvailability;
    
    return {
      allDoctors: doctors,
      doctors: nextDoctors,
      doctorAvailability: nextAvailability,
      availableTurns: dataContext.availableTurns || [],
      myTurns: dataContext.myTurns || [],
      accessToken,
      userId: dataContext.userId || authContext?.authResponse?.id || null,
      specialties: nextSpecialties,
      isLoadingDoctors: shouldCheckAvailability,
      isLoadingAvailableSlots: !!loadingState.availableTurns,
      isLoadingMyTurns: false,
    };
  } catch (error) {
    return { isLoadingMyTurns: false, isLoadingDoctors: false };
  }
};

export const turnMachine = createMachine({
  id: "turnMachine",
  type: "parallel", 
  context: {
    allDoctors: [],
    doctors: [],
    availableTurns: [],
    myTurns: [],
    isLoadingMyTurns: true,
    
    isCreatingTurn: false,
    isCancellingTurn: false,
    cancellingTurnId: null,

    isLoadingAvailableSlots: false,

    error: null,
    cancelSuccess: null,
    modifyError: null,
    
    takeTurn: {
      professionSelected: "",
      profesionalSelected: "",
      doctorId: "",
      dateSelected: null,
      timeSelected: null,
      scheduledAt: null,
      motive: "",
      // new fields for health certificate handling
      needsHealthCertificate: false,
    },
    showTurns: {
      dateSelected: null,
      statusFilter: "",
    },
    modifyTurn: {
      turnId: null,
      currentTurn: null,
      selectedDate: null,
      selectedTime: null,
      availableSlots: [],
      availableDates: [],
      motive: "",
    },
    
    accessToken: null,
    userId: null,
    doctorAvailability: {},
    isLoadingDoctors: false,
    specialties: [],
    availableDates: [],
    isLoadingAvailableDates: false,
  } as TurnMachineContext,
  types: {
    context: {} as TurnMachineContext,
    events: {} as TurnMachineEvent,
  },
  states: {
    takeTurn: {
      initial: "step1",
      states: {
        step1: {
          on: {
            NEXT: "step2",
            RESET_TAKE_TURN: {
              target: "step1",
              actions: assign({
                takeTurn: {
                  professionSelected: "",
                  profesionalSelected: "",
                  doctorId: "",
                  dateSelected: null,
                  timeSelected: null,
                    scheduledAt: null,
                    motive: "",
                    needsHealthCertificate: false,
                },
                availableDates: [],
                isLoadingAvailableDates: false,
              }),
            },
          },
        },
        step2: {
          entry: assign({ isLoadingAvailableDates: true }),
          invoke: {
            src: fromPromise(async ({ input }) => {
              return await TurnService.getAvailableDates(input.doctorId, input.accessToken);
            }),
            input: ({ context }) => ({
              doctorId: context.takeTurn.doctorId,
              accessToken: context.accessToken,
            }),
            onDone: {
              actions: assign({
                availableDates: ({ event }) => event.output,
                isLoadingAvailableDates: false,
              }),
            },
            onError: {
              actions: assign({
                isLoadingAvailableDates: false,
                error: 'Failed to load available dates',
              }),
            },
          },
          on: {
            BACK: "step1",
            RESET_TAKE_TURN: {
              target: "step1",
              actions: assign({
                  takeTurn: {
                    professionSelected: "",
                    profesionalSelected: "",
                    doctorId: "",
                    dateSelected: null,
                    timeSelected: null,
                    scheduledAt: null,
                    motive: "",
                    needsHealthCertificate: false,
                  },
                availableDates: [],
                isLoadingAvailableDates: false,
              }),
            },
          },
        },
      },
    },
    showTurns: {
      initial: "idle",
      states: {
        idle: {
          on: {
            RESET_SHOW_TURNS: {
              target: "idle",
              actions: assign({
                showTurns: { 
                  dateSelected: null,
                  statusFilter: "",
                },
              }),
            },
          },
        },
      },
    },
    modifyTurn: {
      initial: "idle",
      states: {
        idle: {
          always: {
            guard: ({ context }) => !!context.modifyTurn?.turnId,
            target: "modifying"
          },
          on: {
            NAVIGATE: {
              actions: assign({
                modifyTurn: ({ context, event }) => {
                  if (event.to?.includes('/patient/modify-turn')) {
                    const url = new URL(window.location.href);
                    const turnId = url.searchParams.get('turnId');
                    const currentTurn = context.myTurns.find(turn => turn.id === turnId) || null;
                    const scheduledAt = currentTurn ? dayjs(currentTurn.scheduledAt) : null;
                    return {
                      turnId,
                      currentTurn,
                      selectedDate: scheduledAt,
                      selectedTime: currentTurn?.scheduledAt || null,
                      availableSlots: [],
                      availableDates: [],
                      motive: "",
                    };
                  }
                  return {
                    turnId: null,
                    currentTurn: null,
                    selectedDate: null,
                    selectedTime: null,
                    availableSlots: [],
                    availableDates: [],
                    motive: "",
                  };
                }
              }),
            },
          },
        },
        modifying: {
          entry: [
            assign({ isLoadingAvailableDates: true }),
            ({ context }) => {
              // Si ya hay una fecha seleccionada, cargar los slots disponibles automáticamente
              if (context.modifyTurn?.selectedDate && context.modifyTurn?.currentTurn?.doctorId) {
                orchestrator.sendToMachine(DATA_MACHINE_ID, { 
                  type: "LOAD_AVAILABLE_TURNS", 
                  doctorId: context.modifyTurn.currentTurn.doctorId, 
                  date: context.modifyTurn.selectedDate.format('YYYY-MM-DD') 
                });
              }
            }
          ],
          invoke: {
            src: fromPromise(async ({ input }) => {
              if (!input.doctorId) {
                return [];
              }
              return await TurnService.getAvailableDates(input.doctorId, input.accessToken);
            }),
            input: ({ context }) => ({
              doctorId: context.modifyTurn?.currentTurn?.doctorId,
              accessToken: context.accessToken,
            }),
            onDone: {
              actions: assign({
                modifyTurn: ({ context, event }) => {
                  return {
                    ...context.modifyTurn,
                    availableDates: event.output,
                  }
                },
                isLoadingAvailableDates: false,
              }),
            },
            onError: {
              actions: assign({
                isLoadingAvailableDates: false,
                error: 'Failed to load available dates',
              }),
            },
          },
          on: {
            LOAD_MODIFY_AVAILABLE_SLOTS: {
              actions: [
                ({context}) => {
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_AVAILABLE_TURNS", doctorId: context.modifyTurn?.currentTurn?.doctorId, date: context.modifyTurn?.selectedDate?.format('YYYY-MM-DD') });
                }
              ]
            },
            SUBMIT_MODIFY_REQUEST: "submittingModifyRequest",
            NAVIGATE: [
              {
                guard: ({ event }) => !!event.to?.includes('/patient/modify-turn'),
                actions: assign({
                  modifyTurn: ({ context }) => {
                    const url = new URL(window.location.href);
                    const turnId = url.searchParams.get('turnId');
                    const currentTurn = context.myTurns.find(turn => turn.id === turnId) || null;
                    const scheduledAt = currentTurn ? dayjs(currentTurn.scheduledAt) : null;
                    return {
                      turnId,
                      currentTurn,
                      selectedDate: scheduledAt,
                      selectedTime: currentTurn?.scheduledAt || null,
                      availableSlots: [],
                      availableDates: [],
                      motive: "",
                    };
                  }
                }),
                target: "idle" // Primero ir a idle para forzar reinicio completo
              },
              {
                target: "idle",
                actions: assign({
                    modifyTurn: {
                    turnId: null,
                    currentTurn: null,
                    selectedDate: null,
                    selectedTime: null,
                    availableSlots: [],
                    availableDates: [],
                    motive: "",
                  }
                }),
              }
            ],
          }
        },
        submittingModifyRequest: {
          invoke: {
            src: fromPromise(async ({ input }: { input: { turnId: string | null; selectedDate: Dayjs | null; selectedTime: string | null; accessToken: string | null } }) => {
              const { turnId, selectedDate, selectedTime, accessToken } = input;

              if (!selectedDate || !selectedTime) {
                throw new Error("Fecha y hora deben estar seleccionadas");
              }

              if (typeof selectedTime !== 'string' || !selectedTime.includes('T') || !selectedTime.split('T')[1]) {
                throw new Error("Formato de hora inválido");
              }

              const timePart = selectedTime.split('T')[1];
              const newScheduledAt = `${selectedDate.format('YYYY-MM-DD')}T${timePart}`;

              return await TurnModifyService.createModifyRequest({
                turnId: turnId!,
                newScheduledAt
              }, accessToken!);
            }),
            input: ({ context }: any) => ({
              turnId: context.modifyTurn?.turnId ?? null,
              selectedDate: context.modifyTurn?.selectedDate ?? null,
              selectedTime: context.modifyTurn?.selectedTime ?? null,
              accessToken: (() => {
                try {
                  const dataSnapshot = orchestrator.getSnapshot(DATA_MACHINE_ID);
                  return dataSnapshot?.context?.accessToken || null;
                } catch {
                  return null;
                }
              })(),
            }),
            onDone: {
              target: "idle",
              actions: [
                assign({
                  modifyError: null,
                }),
                () => {
                  // Cargar solo myTurns - myModifyRequests se cargará automáticamente después
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
                  
                  // Mostrar mensaje de éxito
                  orchestrator.sendToMachine(UI_MACHINE_ID, {
                    type: "OPEN_SNACKBAR",
                    message: "Solicitud de modificación enviada exitosamente",
                    severity: "success"
                  });
                  
                  // Navegar inmediatamente - los datos se cargarán secuencialmente
                  orchestrator.sendToMachine(UI_MACHINE_ID, { type: "NAVIGATE", to: "/patient/view-turns" });
                }
              ]
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  modifyError: ({ event }: any) => (event.error as Error)?.message || "Error enviando solicitud de modificación"
                }),
                () => {
                  orchestrator.sendToMachine(UI_MACHINE_ID, {
                    type: "OPEN_SNACKBAR",
                    message: "Error enviando solicitud de modificación",
                    severity: "error"
                  });
                }
              ]
            }
          }
        },
      },
    },
    dataManagement: {
      initial: "idle",
      states: {
        idle: {
          on: {
            DATA_LOADED: {
              actions: [
                assign(({ context }) => mapDataMachineSnapshotToContext(context)),
                ({ context, self }) => {
                  if (!context.isLoadingDoctors) {
                    return;
                  }
                  const snapshot = self.getSnapshot?.();
                  if (snapshot?.matches?.({ dataManagement: 'idle' })) {
                    self.send({ type: "CHECK_DOCTOR_AVAILABILITY" });
                  }
                },
              ],
            },
            CHECK_DOCTOR_AVAILABILITY: {
              guard: ({ context }) => context.isLoadingDoctors && !!context.accessToken,
              target: "checkingAvailability",
            },
            LOADING: {
              actions: assign(() => ({
                isLoadingMyTurns: true,
                error: null,
              }))
            }, 
            CREATE_TURN: {
              target: "creatingTurn",
            }
          },
        },
        checkingAvailability: {
          entry: assign({
            isLoadingDoctors: true,
          }),
          on: {
            DATA_LOADED: {
              actions: [
                assign(({ context }) => mapDataMachineSnapshotToContext(context)),
                ({ context, self }) => {
                  if (!context.isLoadingDoctors) {
                    return;
                  }
                  const snapshot = self.getSnapshot?.();
                  if (snapshot?.matches?.({ dataManagement: 'idle' })) {
                    self.send({ type: "CHECK_DOCTOR_AVAILABILITY" });
                  }
                },
              ],
              target: "checkingAvailability",
              reenter: true,
            },
            CHECK_DOCTOR_AVAILABILITY: {
              guard: ({ context }) => context.isLoadingDoctors && !!context.accessToken,
              target: "checkingAvailability",
              reenter: true,
            },
          },
          invoke: {
            src: fromPromise(async ({ input }: { input: { doctors: Doctor[]; accessToken: string } }) => {
              const availability = await buildDoctorAvailabilityMap(input.doctors, input.accessToken);
              const filteredDoctors = input.doctors.filter((doctor) => availability[doctor.id]);
              return {
                availability,
                filteredDoctors,
                specialties: buildSpecialtyOptions(filteredDoctors),
              };
            }),
            input: ({ context }) => ({
              doctors: context.allDoctors,
              accessToken: context.accessToken!,
            }),
            onDone: {
              target: "idle",
              actions: assign({
                doctorAvailability: ({ context, event }) => ({
                  ...context.doctorAvailability,
                  ...(event.output?.availability || {}),
                }),
                doctors: ({ event }) => event.output?.filteredDoctors || [],
                specialties: ({ event }) => event.output?.specialties || [],
                isLoadingDoctors: () => false,
                takeTurn: ({ context, event }) => {
                  const { takeTurn } = context;
                  const filteredDoctors = event.output?.filteredDoctors || [];
                  const availableDoctorIds = new Set(filteredDoctors.map((doctor: Doctor) => doctor.id));
                  const availableSpecialties = new Set((event.output?.specialties || []).map((item: { value: string }) => item.value));

                  const isDoctorValid = availableDoctorIds.has(takeTurn.doctorId);
                  const isSpecialtyValid = availableSpecialties.has(takeTurn.professionSelected);

                  return {
                    ...takeTurn,
                    professionSelected: isSpecialtyValid ? takeTurn.professionSelected : "",
                    doctorId: isDoctorValid ? takeTurn.doctorId : "",
                    profesionalSelected: isDoctorValid ? takeTurn.profesionalSelected : "",
                    dateSelected: isDoctorValid ? takeTurn.dateSelected : null,
                    timeSelected: isDoctorValid ? takeTurn.timeSelected : null,
                    scheduledAt: isDoctorValid ? takeTurn.scheduledAt : null,
                    needsHealthCertificate: isDoctorValid ? takeTurn.needsHealthCertificate : false,
                  };
                },
                availableDates: ({ context, event }) => {
                  const filteredDoctors = event.output?.filteredDoctors || [];
                  const availableDoctorIds = new Set(filteredDoctors.map((doctor: Doctor) => doctor.id));
                  return availableDoctorIds.has(context.takeTurn.doctorId) ? context.availableDates : [];
                },
                availableTurns: ({ context, event }) => {
                  const filteredDoctors = event.output?.filteredDoctors || [];
                  const availableDoctorIds = new Set(filteredDoctors.map((doctor: Doctor) => doctor.id));
                  return availableDoctorIds.has(context.takeTurn.doctorId) ? context.availableTurns : [];
                },
              }),
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isLoadingDoctors: () => false,
                }),
                () => {
                  orchestrator.sendToMachine(UI_MACHINE_ID, {
                    type: "OPEN_SNACKBAR",
                    message: "No se pudo obtener la disponibilidad de los doctores",
                    severity: "error",
                  });
                }
              ],
            },
          },
        },
        creatingTurn: {
          entry: assign({
            isCreatingTurn: true,
            error: null,
          }),
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; userId: string; doctorId: string; scheduledAt: string } }) => {
              return await createTurn(input);
            }),
            input: ({ context }) => {
              const inputData = {
                accessToken: context.accessToken!,
                userId: context.userId!,
                doctorId: context.takeTurn.doctorId,
                scheduledAt: context.takeTurn.scheduledAt!,
                motive: context.takeTurn.motive || undefined,
              };
              
              return inputData;
            },
            onDone: {
              target: "idle",
              actions: [
                assign({
                  isCreatingTurn: false,
                  error: null,
                }),

                assign({
                  takeTurn: {
                    professionSelected: "",
                    profesionalSelected: "",
                    doctorId: "",
                    dateSelected: null,
                    timeSelected: null,
                    scheduledAt: null,
                    motive: "",
                    needsHealthCertificate: false,
                  },
                  availableDates: [],
                  isLoadingAvailableDates: false,
                }),

                () => {
                  orchestrator.sendToMachine("turn", { type: "RESET_TAKE_TURN" });
                  
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Turno creado exitosamente", 
                    severity: "success" 
                  });
                  orchestrator.sendToMachine(UI_MACHINE_ID, { type: "NAVIGATE", to: "/patient" });
                },                
              ],
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isCreatingTurn: false,
                  error: ({ event }) => (event.error as Error)?.message || "Error creating turn",
                }),
                ({ event }) => {
                  const errorMessage = (event.error as Error)?.message || "Error al crear el turno";
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
        cancellingTurn: {
          entry: assign({
            isCancellingTurn: true,
          }),
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; turnId: string } }) => {
              return await cancelTurn(input);
            }),
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              turnId: context.cancellingTurnId!
            }),
            onDone: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  cancelSuccess: "Turno cancelado exitosamente",
                }),
                () => {
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Turno cancelado exitosamente", 
                    severity: "success" 
                  });
                }
              ],
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  error: ({ event }) => (event.error as Error)?.message || "Error al cancelar el turno",
                }),
                ({ event }) => {
                  const errorMessage = (event.error as Error)?.message || "Error al cancelar el turno";
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
        completingTurn: {
          entry: assign({
            isCancellingTurn: true,
          }),
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; turnId: string } }) => {
              return await completeTurn(input);
            }),
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              turnId: context.cancellingTurnId!
            }),
            onDone: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  cancelSuccess: "Turno marcado como completado",
                }),
                () => {
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Turno marcado como completado exitosamente", 
                    severity: "success" 
                  });
                }
              ],
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  error: ({ event }) => (event.error as Error)?.message || "Error al completar el turno",
                }),
                ({ event }) => {
                  const errorMessage = (event.error as Error)?.message || "Error al completar el turno";
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
        noShowingTurn: {
          entry: assign({
            isCancellingTurn: true,
          }),
          invoke: {
            src: fromPromise(async ({ input }: { input: { accessToken: string; turnId: string } }) => {
              return await noShowTurn(input);
            }),
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              turnId: context.cancellingTurnId!
            }),
            onDone: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  cancelSuccess: "Turno marcado como no asistió",
                }),
                () => {
                  orchestrator.sendToMachine(DATA_MACHINE_ID, { type: "LOAD_MY_TURNS" });
                  orchestrator.sendToMachine(UI_MACHINE_ID, { 
                    type: "OPEN_SNACKBAR", 
                    message: "Turno marcado como no asistió exitosamente", 
                    severity: "info" 
                  });
                }
              ],
            },
            onError: {
              target: "idle",
              actions: [
                assign({
                  isCancellingTurn: false,
                  cancellingTurnId: null,
                  error: ({ event }) => (event.error as Error)?.message || "Error al marcar el turno como no asistió",
                }),
                ({ event }) => {
                  const errorMessage = (event.error as Error)?.message || "Error al marcar el turno como no asistió";
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
    CANCEL_TURN: {
      target: ".dataManagement.cancellingTurn",
      actions: assign({
        cancellingTurnId: ({ event }) => event.turnId,
      }),
    },
    COMPLETE_TURN: {
      target: ".dataManagement.completingTurn",
      actions: assign({
        cancellingTurnId: ({ event }) => event.turnId,
      }),
    },
    NO_SHOW_TURN: {
      target: ".dataManagement.noShowingTurn",
      actions: assign({
        cancellingTurnId: ({ event }) => event.turnId,
      }),
    },
    CLEAR_CANCEL_SUCCESS: {
      actions: assign({
        cancelSuccess: null,
      }),
    },
    SET_AVAILABLE_SLOTS_LOADING: {
      actions: assign({
        isLoadingAvailableSlots: ({ event }) => event.isLoading,
      }),
    },
    UPDATE_FORM: {
      actions: assign(({ context, event }) => {
        if (event.type !== "UPDATE_FORM" || !event.path || event.path.length === 0) {
          return {};
        }
        const newContext = { ...context } as any;
        let current = newContext;
        for (let i = 0; i < event.path.length - 1; i++) {
          const key = event.path[i];
          current[key] = { ...current[key] };
          current = current[key];
        }
        current[event.path[event.path.length - 1]] = event.value;
        return newContext;
      }),
    }
  },
});