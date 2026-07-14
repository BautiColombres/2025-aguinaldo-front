import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import PatientFollowUpReminders from './PatientFollowUpReminders';
import { useMachines } from '#/providers/MachineProvider';
import { useAuthMachine } from '#/providers/AuthProvider';
import type { FollowUpReminder } from '#/models/FollowUpReminder';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

const reminder = (over: Partial<FollowUpReminder> = {}): FollowUpReminder => ({
  id: 'reminder-1',
  patientId: 'patient-1',
  patientName: 'John',
  patientSurname: 'Doe',
  doctorId: 'doctor-1',
  historyId: 'history-1',
  turnId: 'turn-1',
  monthsUntilControl: 3,
  scheduledFor: '2024-08-10',
  dismissed: false,
  createdAt: '2024-05-10T10:00:00Z',
  ...over,
});

const setup = ({ patientReminders = [] as FollowUpReminder[] } = {}) => {
  const followUpSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    followUpState: {
      context: {
        dueReminders: [],
        patientReminders,
        isLoading: false,
        error: null,
      },
    },
    followUpSend,
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: {
      context: {
        authResponse: { accessToken: 'token-123', id: 'patient-1' },
      },
    },
  });

  render(<PatientFollowUpReminders />);
  return { followUpSend };
};

describe('PatientFollowUpReminders (F2-F4b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the patient reminders via the machine on mount', () => {
    const { followUpSend } = setup();

    expect(followUpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOAD_PATIENT_FOLLOWUPS',
        patientId: 'patient-1',
        accessToken: 'token-123',
      }),
    );
  });

  it('renders the pending reminders with generic copy and the control date', () => {
    setup({ patientReminders: [reminder({ scheduledFor: '2024-08-10' })] });

    expect(screen.getByText(/Tu profesional te recomienda un control/i)).toBeInTheDocument();
    expect(screen.getByText(/10\/08\/2024/)).toBeInTheDocument();
  });

  it('does not leak any clinical tag/motive text', () => {
    setup({ patientReminders: [reminder()] });

    expect(screen.queryByText(/diabetes|hipertensión|motivo/i)).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no pending reminders', () => {
    setup({ patientReminders: [] });

    expect(screen.getByText(/No tenés recordatorios de control pendientes/i)).toBeInTheDocument();
  });
});
