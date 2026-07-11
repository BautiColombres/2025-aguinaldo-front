import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the orchestrator BEFORE importing the provider
vi.mock('../core/Orchestrator', () => ({
  orchestrator: {
    registerMachine: vi.fn(),
  },
}));

// Mock the useStateMachine hook
vi.mock('../hooks/useStateMachine', () => ({
  useStateMachine: vi.fn(),
}));

// Mock all the machines
vi.mock('../machines/uiMachine', () => ({
  UI_MACHINE_ID: 'ui-machine',
  UI_MACHINE_EVENT_TYPES: ['UI_EVENT_1', 'UI_EVENT_2'],
  uiMachine: { id: 'ui-machine' },
}));

vi.mock('../machines/turnMachine', () => ({
  TURN_MACHINE_ID: 'turn-machine',
  TURN_MACHINE_EVENT_TYPES: ['TURN_EVENT_1', 'TURN_EVENT_2'],
  turnMachine: { id: 'turn-machine' },
}));

vi.mock('../machines/doctorMachine', () => ({
  DOCTOR_MACHINE_ID: 'doctor-machine',
  DOCTOR_MACHINE_EVENT_TYPES: ['DOCTOR_EVENT_1', 'DOCTOR_EVENT_2'],
  doctorMachine: { id: 'doctor-machine' },
  default: { id: 'doctor-machine' },
}));

vi.mock('../machines/adminUserMachine', () => ({
  ADMIN_USER_MACHINE_ID: 'admin-user-machine',
  ADMIN_USER_MACHINE_EVENT_TYPES: ['ADMIN_EVENT_1', 'ADMIN_EVENT_2'],
  adminUserMachine: { id: 'admin-user-machine' },
}));

vi.mock('../machines/profileMachine', () => ({
  PROFILE_MACHINE_ID: 'profile-machine',
  PROFILE_MACHINE_EVENT_TYPES: ['PROFILE_EVENT_1', 'PROFILE_EVENT_2'],
  profileMachine: { id: 'profile-machine' },
}));

vi.mock('../machines/notificationMachine', () => ({
  NOTIFICATION_MACHINE_ID: 'notification-machine',
  NOTIFICATION_MACHINE_EVENT_TYPES: ['NOTIFICATION_EVENT_1', 'NOTIFICATION_EVENT_2'],
  notificationMachine: { id: 'notification-machine' },
}));

vi.mock('../machines/medicalHistoryMachine', () => ({
  MEDICAL_HISTORY_MACHINE_ID: 'medical-history-machine',
  MEDICAL_HISTORY_MACHINE_EVENT_TYPES: ['MEDICAL_HISTORY_EVENT_1', 'MEDICAL_HISTORY_EVENT_2'],
  medicalHistoryMachine: { id: 'medical-history-machine' },
}));

vi.mock('../machines/filesMachine', () => ({
  FILES_MACHINE_ID: 'files-machine',
  FILES_MACHINE_EVENT_TYPES: ['FILES_EVENT_1', 'FILES_EVENT_2'],
  filesMachine: { id: 'files-machine' },
}));

vi.mock('../machines/ratingMachine', () => ({
  RATING_MACHINE_ID: 'rating-machine',
  RATING_MACHINE_EVENT_TYPES: ['RATING_EVENT_1', 'RATING_EVENT_2'],
  ratingMachine: { id: 'rating-machine' },
}));

vi.mock('../machines/badgeMachine', () => ({
  BADGE_MACHINE_ID: 'badge-machine',
  BADGE_MACHINE_EVENT_TYPES: ['BADGE_EVENT_1', 'BADGE_EVENT_2'],
  badgeMachine: { id: 'badge-machine' },
  default: { id: 'badge-machine' },
}));

// Import the mocked module
import { useStateMachine } from '../hooks/useStateMachine';

// Import the provider AFTER the mocks
import { MachineProvider, useMachines } from './MachineProvider';

// Test component that uses the machines hook
const TestComponent = () => {
  const machines = useMachines();
  return (
    <div>
      <div data-testid="ui-state">{JSON.stringify(machines.uiState)}</div>
      <div data-testid="turn-state">{JSON.stringify(machines.turnState)}</div>
      <div data-testid="doctor-state">{JSON.stringify(machines.doctorState)}</div>
      <div data-testid="admin-state">{JSON.stringify(machines.adminUserState)}</div>
      <div data-testid="profile-state">{JSON.stringify(machines.profileState)}</div>
      <div data-testid="notification-state">{JSON.stringify(machines.notificationState)}</div>
      <div data-testid="medical-history-state">{JSON.stringify(machines.medicalHistoryState)}</div>
      <button
        data-testid="ui-send"
        onClick={() => machines.uiSend({ type: 'TOGGLE', key: 'test' })}
      >
        Send UI Event
      </button>
      <button
        data-testid="turn-send"
        onClick={() => machines.turnSend({ type: 'NAVIGATE', to: 'test' })}
      >
        Send Turn Event
      </button>
      <button
        data-testid="doctor-send"
        onClick={() => machines.doctorSend({ type: 'DATA_LOADED' })}
      >
        Send Doctor Event
      </button>
      <button
        data-testid="admin-send"
        onClick={() => machines.adminUserSend({ type: 'ADMIN_TEST_EVENT' })}
      >
        Send Admin Event
      </button>
      <button
        data-testid="profile-send"
        onClick={() => machines.profileSend({ type: 'UPDATE_FORM', key: 'test', value: 'test' })}
      >
        Send Profile Event
      </button>
      <button
        data-testid="notification-send"
        onClick={() => machines.notificationSend({ type: 'LOAD_NOTIFICATIONS', accessToken: 'test' })}
      >
        Send Notification Event
      </button>
    </div>
  );
};

// Test component that throws error when used outside provider
const TestComponentOutsideProvider = () => {
  try {
    useMachines();
    return <div>No error thrown</div>;
  } catch (error) {
    return <div data-testid="error">{(error as Error).message}</div>;
  }
};

describe('MachineProvider', () => {
  const mockStates = {
    uiState: { value: 'idle', context: {} },
    turnState: { value: 'idle', context: {} },
    doctorState: { value: 'idle', context: {} },
    adminUserState: { value: 'idle', context: {} },
    profileState: { value: 'idle', context: {} },
    notificationState: { value: 'idle', context: {} },
    medicalHistoryState: null,
    filesState: null,
    ratingState: null,
    badgeState: null,
  };

  const mockSends = {
    uiSend: vi.fn(),
    turnSend: vi.fn(),
    doctorSend: vi.fn(),
    adminUserSend: vi.fn(),
    profileSend: vi.fn(),
    notificationSend: vi.fn(),
    medicalHistorySend: vi.fn(),
    filesSend: vi.fn(),
    ratingSend: vi.fn(),
    badgeSend: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useStateMachine to return different values based on machine ID
    (useStateMachine as any).mockImplementation((machineId: string) => {
      switch (machineId) {
        case 'ui-machine':
          return { state: mockStates.uiState, send: mockSends.uiSend };
        case 'turn-machine':
          return { state: mockStates.turnState, send: mockSends.turnSend };
        case 'doctor-machine':
          return { state: mockStates.doctorState, send: mockSends.doctorSend };
        case 'admin-user-machine':
          return { state: mockStates.adminUserState, send: mockSends.adminUserSend };
        case 'profile-machine':
          return { state: mockStates.profileState, send: mockSends.profileSend };
        case 'notification-machine':
          return { state: mockStates.notificationState, send: mockSends.notificationSend };
        case 'medical-history-machine':
          return { state: mockStates.medicalHistoryState, send: mockSends.medicalHistorySend };
        case 'files-machine':
          return { state: mockStates.filesState, send: mockSends.filesSend };
        case 'rating-machine':
          return { state: mockStates.ratingState, send: mockSends.ratingSend };
        case 'badge-machine':
          return { state: mockStates.badgeState, send: mockSends.badgeSend };
        default:
          return { state: null, send: vi.fn() };
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide all machine states through context', () => {
    render(
      <MachineProvider>
        <TestComponent />
      </MachineProvider>
    );

    expect(screen.getByTestId('ui-state')).toHaveTextContent(JSON.stringify(mockStates.uiState));
    expect(screen.getByTestId('turn-state')).toHaveTextContent(JSON.stringify(mockStates.turnState));
    expect(screen.getByTestId('doctor-state')).toHaveTextContent(JSON.stringify(mockStates.doctorState));
    expect(screen.getByTestId('admin-state')).toHaveTextContent(JSON.stringify(mockStates.adminUserState));
    expect(screen.getByTestId('profile-state')).toHaveTextContent(JSON.stringify(mockStates.profileState));
    expect(screen.getByTestId('notification-state')).toHaveTextContent(JSON.stringify(mockStates.notificationState));
  });

  it('should render children correctly', () => {
    render(
      <MachineProvider>
        <div data-testid="child">Test Child</div>
      </MachineProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Test Child');
  });

  it('should call send functions when invoked', () => {
    render(
      <MachineProvider>
        <TestComponent />
      </MachineProvider>
    );

    screen.getByTestId('ui-send').click();
    screen.getByTestId('turn-send').click();
    screen.getByTestId('doctor-send').click();
    screen.getByTestId('admin-send').click();
    screen.getByTestId('profile-send').click();
    screen.getByTestId('notification-send').click();

    expect(mockSends.uiSend).toHaveBeenCalledWith({ type: 'TOGGLE', key: 'test' });
    expect(mockSends.turnSend).toHaveBeenCalledWith({ type: 'NAVIGATE', to: 'test' });
    expect(mockSends.doctorSend).toHaveBeenCalledWith({ type: 'DATA_LOADED' });
    expect(mockSends.adminUserSend).toHaveBeenCalledWith({ type: 'ADMIN_TEST_EVENT' });
    expect(mockSends.profileSend).toHaveBeenCalledWith({ type: 'UPDATE_FORM', key: 'test', value: 'test' });
    expect(mockSends.notificationSend).toHaveBeenCalledWith({ type: 'LOAD_NOTIFICATIONS', accessToken: 'test' });
  });

  it('should throw error when useMachines is used outside provider', () => {
    render(<TestComponentOutsideProvider />);

    expect(screen.getByTestId('error')).toHaveTextContent(
      'useMachines must be used within a MachineProvider'
    );
  });

  it('should call useStateMachine for each machine ID', () => {
    render(
      <MachineProvider>
        <TestComponent />
      </MachineProvider>
    );

    expect(useStateMachine).toHaveBeenCalledWith('ui-machine');
    expect(useStateMachine).toHaveBeenCalledWith('turn-machine');
    expect(useStateMachine).toHaveBeenCalledWith('doctor-machine');
    expect(useStateMachine).toHaveBeenCalledWith('admin-user-machine');
    expect(useStateMachine).toHaveBeenCalledWith('profile-machine');
    expect(useStateMachine).toHaveBeenCalledWith('notification-machine');
  });

  // FBUG-H1: doctorMachine must be registered exactly once (a duplicate
  // registerMachine block previously registered it twice).
  it('should register doctorMachine exactly once (no duplicate registration)', async () => {
    vi.resetModules();
    const { orchestrator } = await import('../core/Orchestrator');
    (orchestrator.registerMachine as any).mockClear();

    await import('./MachineProvider');

    const doctorRegistrations = (orchestrator.registerMachine as any).mock.calls.filter(
      (call: any[]) => call[0]?.id === 'doctor-machine'
    );
    expect(doctorRegistrations).toHaveLength(1);
  });

  it('should provide the correct machine instances structure', () => {
    let capturedContext: any = null;

    const CaptureContextComponent = () => {
      capturedContext = useMachines();
      return <div>Captured</div>;
    };

    render(
      <MachineProvider>
        <CaptureContextComponent />
      </MachineProvider>
    );

    expect(capturedContext).toEqual({
      uiState: mockStates.uiState,
      uiSend: mockSends.uiSend,
      turnState: mockStates.turnState,
      turnSend: mockSends.turnSend,
      doctorState: mockStates.doctorState,
      doctorSend: mockSends.doctorSend,
      adminUserState: mockStates.adminUserState,
      adminUserSend: mockSends.adminUserSend,
      profileState: mockStates.profileState,
      profileSend: mockSends.profileSend,
      notificationState: mockStates.notificationState,
      notificationSend: mockSends.notificationSend,
      medicalHistoryState: mockStates.medicalHistoryState,
      medicalHistorySend: mockSends.medicalHistorySend,
      filesState: mockStates.filesState,
      filesSend: mockSends.filesSend,
      ratingState: mockStates.ratingState,
      ratingSend: mockSends.ratingSend,
      badgeState: mockStates.badgeState,
      badgeSend: mockSends.badgeSend,
    });
  });
});