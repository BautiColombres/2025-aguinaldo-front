import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { orchestrator } from '#/core/Orchestrator';
import { useStateMachine } from '#/hooks/useStateMachine';
import { uiMachine, UI_MACHINE_ID, UI_MACHINE_EVENT_TYPES, type UiMachineEvent } from '../machines/uiMachine';
import { turnMachine, TURN_MACHINE_ID, TURN_MACHINE_EVENT_TYPES, type TurnMachineEvent } from '../machines/turnMachine';
import doctorMachine, { DOCTOR_MACHINE_ID, DOCTOR_MACHINE_EVENT_TYPES, type DoctorMachineEvent } from '../machines/doctorMachine';
import { adminUserMachine, ADMIN_USER_MACHINE_ID, ADMIN_USER_MACHINE_EVENT_TYPES } from '#/machines/adminUserMachine';
import { profileMachine, PROFILE_MACHINE_ID, PROFILE_MACHINE_EVENT_TYPES, type ProfileMachineEvent } from '../machines/profileMachine';
import { notificationMachine, NOTIFICATION_MACHINE_ID, NOTIFICATION_MACHINE_EVENT_TYPES, type NotificationMachineEvent } from '../machines/notificationMachine';
import { medicalHistoryMachine, MEDICAL_HISTORY_MACHINE_ID, MEDICAL_HISTORY_MACHINE_EVENT_TYPES, type MedicalHistoryMachineEvent } from '#/machines/medicalHistoryMachine';
import { filesMachine, FILES_MACHINE_ID, FILES_MACHINE_EVENT_TYPES, type FilesMachineEvent } from '../machines/filesMachine';
import { ratingMachine, RATING_MACHINE_ID, RATING_MACHINE_EVENT_TYPES } from '../machines/ratingMachine';
import badgeMachine, { BADGE_MACHINE_ID, BADGE_MACHINE_EVENT_TYPES, type BadgeMachineEvent } from '../machines/badgeMachine';

interface MachineInstances {
    uiState: any;
    uiSend: (event: UiMachineEvent) => void;
    turnState: any;
    turnSend: (event: TurnMachineEvent) => void;
    doctorState: any;
    doctorSend: (event: DoctorMachineEvent) => void;
    adminUserState: any;
    adminUserSend: (event: any) => void;
    profileState: any;
    profileSend: (event: ProfileMachineEvent) => void;
    notificationState: any;
    notificationSend: (event: NotificationMachineEvent) => void;
    medicalHistoryState:any;
    medicalHistorySend: (event: MedicalHistoryMachineEvent) => void;
    filesState: any;
    filesSend: (event: FilesMachineEvent) => void;
    ratingState: any;
    ratingSend: (event: any) => void;
    badgeState: any;
    badgeSend: (event: BadgeMachineEvent) => void;
}

interface MachineProviderProps {
  children: ReactNode;
}

const MachineContext = createContext<MachineInstances | null>(null);

orchestrator.registerMachine({
  id: UI_MACHINE_ID,
  machine: uiMachine,
  eventTypes: UI_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: TURN_MACHINE_ID,
  machine: turnMachine,
  eventTypes: TURN_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: DOCTOR_MACHINE_ID,
  machine: doctorMachine,
    eventTypes: DOCTOR_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: ADMIN_USER_MACHINE_ID,
  machine: adminUserMachine,
  eventTypes: ADMIN_USER_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: PROFILE_MACHINE_ID,
  machine: profileMachine,
  eventTypes: PROFILE_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: NOTIFICATION_MACHINE_ID,
  machine: notificationMachine,
  eventTypes: NOTIFICATION_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: MEDICAL_HISTORY_MACHINE_ID,
  machine: medicalHistoryMachine,
  eventTypes: MEDICAL_HISTORY_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: FILES_MACHINE_ID,
  machine: filesMachine,
  eventTypes: FILES_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: RATING_MACHINE_ID,
  machine: ratingMachine,
  eventTypes: RATING_MACHINE_EVENT_TYPES
});

orchestrator.registerMachine({
  id: BADGE_MACHINE_ID,
  machine: badgeMachine,
  eventTypes: BADGE_MACHINE_EVENT_TYPES
});

export const MachineProvider: React.FC<MachineProviderProps> = ({ children }) => {
  const { state: uiState, send: uiSend } = useStateMachine(UI_MACHINE_ID);
  const { state: turnState, send: turnSend } = useStateMachine(TURN_MACHINE_ID);
  const { state: doctorState, send: doctorSend } = useStateMachine(DOCTOR_MACHINE_ID);
  const { state: adminUserState, send: adminUserSend } = useStateMachine(ADMIN_USER_MACHINE_ID);
  const { state: profileState, send: profileSend } = useStateMachine(PROFILE_MACHINE_ID);
  const { state: notificationState, send: notificationSend } = useStateMachine(NOTIFICATION_MACHINE_ID);
  const { state: medicalHistoryState, send: medicalHistorySend } = useStateMachine(MEDICAL_HISTORY_MACHINE_ID);
  const { state: filesState, send: filesSend } = useStateMachine(FILES_MACHINE_ID);
  const { state: ratingState, send: ratingSend } = useStateMachine(RATING_MACHINE_ID);
  const { state: badgeState, send: badgeSend } = useStateMachine(BADGE_MACHINE_ID);

  const machines: MachineInstances = {
      uiState: uiState,
      uiSend: uiSend,
      turnState: turnState,
      turnSend: turnSend,
      doctorState: doctorState,
      doctorSend: doctorSend,
      adminUserState: adminUserState,
      adminUserSend: adminUserSend,
      profileState: profileState,
      profileSend: profileSend,
      notificationState: notificationState,
      notificationSend: notificationSend,
      medicalHistoryState:medicalHistoryState,
      medicalHistorySend: medicalHistorySend,
      filesState: filesState,
      filesSend: filesSend,
      ratingState: ratingState,
      ratingSend: ratingSend,
      badgeState: badgeState,
      badgeSend: badgeSend,
  };

  return (
    <MachineContext.Provider value={machines}>
      {children}
    </MachineContext.Provider>
  );
};

export const useMachines = (): MachineInstances => {
  const context = useContext(MachineContext);
  if (!context) {
    throw new Error('useMachines must be used within a MachineProvider');
  }
  return context;
};
