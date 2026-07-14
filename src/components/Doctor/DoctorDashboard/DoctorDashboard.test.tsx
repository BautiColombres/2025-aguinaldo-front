import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import DoctorDashboard from './DoctorDashboard';
import { useMachines } from '#/providers/MachineProvider';
import { useAuthMachine } from '#/providers/AuthProvider';
import { useDataMachine } from '#/providers/DataProvider';
import type { DueForFollowUp } from '#/models/FollowUpReminder';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

vi.mock('#/providers/DataProvider', () => ({
  useDataMachine: vi.fn(),
}));

const due = (over: Partial<DueForFollowUp> = {}): DueForFollowUp => ({
  patientId: 'patient-1',
  patientName: 'John',
  patientSurname: 'Doe',
  scheduledFor: '2024-08-10',
  lastTurnDate: '2024-05-10T10:00:00Z',
  ...over,
});

const setup = (dueForFollowUp: DueForFollowUp[]) => {
  const uiSend = vi.fn();
  const followUpSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    uiSend,
    turnState: { context: { myTurns: [], isLoadingMyTurns: false, myTurnsError: null } },
    doctorState: {
      context: {
        accessToken: 'token-123',
        doctorId: 'doctor-1',
        availability: [],
        isLoadingAvailability: false,
      },
    },
    badgeState: { context: { badges: [], progress: [], isLoadingBadges: false, isLoadingProgress: false } },
    followUpState: { context: { dueForFollowUp, isLoading: false, error: null } },
    followUpSend,
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: { context: { authResponse: { name: 'Ada', surname: 'Lovelace' } } },
  });

  (useDataMachine as unknown as Mock).mockReturnValue({
    dataState: {
      context: {
        doctorModifyRequests: [],
        loading: {
          initializing: false,
          myTurns: false,
          doctorPatients: false,
          doctorAvailability: false,
          doctorModifyRequests: false,
        },
      },
    },
    dataSend: vi.fn(),
  });

  const utils = render(<DoctorDashboard />);
  return { uiSend, followUpSend, ...utils };
};

describe('DoctorDashboard — follow-up card (F3-F2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches LOAD_DUE_FOR_FOLLOWUP on mount', () => {
    const { followUpSend } = setup([]);

    expect(followUpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOAD_DUE_FOR_FOLLOWUP',
        doctorId: 'doctor-1',
        accessToken: 'token-123',
      }),
    );
  });

  it('renders the count of patients due for follow-up from the machine', () => {
    setup([due({ patientId: 'p1' }), due({ patientId: 'p2' }), due({ patientId: 'p3' })]);

    expect(screen.getByText('Seguimiento pendiente')).toBeInTheDocument();
    expect(screen.getByText(/3 pacientes/i)).toBeInTheDocument();
  });

  it('shows the empty message when no patients are due', () => {
    setup([]);

    expect(screen.getByText('Seguimiento pendiente')).toBeInTheDocument();
    expect(screen.getByText(/no hay pacientes con seguimiento pendiente/i)).toBeInTheDocument();
    expect(screen.queryByText(/pacientes deben volver/i)).not.toBeInTheDocument();
  });

  it('navigates to the dedicated panel when the card is clicked', () => {
    const { uiSend } = setup([due({ patientId: 'p1' })]);

    fireEvent.click(screen.getByText('Ver seguimientos'));

    expect(uiSend).toHaveBeenCalledWith({ type: 'NAVIGATE', to: '/doctor/follow-up-panel' });
  });
});
