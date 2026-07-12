import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import FollowUpPanel from './FollowUpPanel';
import { useMachines } from '#/providers/MachineProvider';
import type { DueForFollowUp } from '#/models/FollowUpReminder';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
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
  const followUpSend = vi.fn();
  const doctorSend = vi.fn();
  const uiSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    followUpState: {
      context: {
        dueForFollowUp,
        isLoading: false,
        error: null,
      },
    },
    followUpSend,
    doctorState: {
      context: {
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      },
    },
    doctorSend,
    uiSend,
  });

  const utils = render(<FollowUpPanel />);
  return { followUpSend, doctorSend, uiSend, ...utils };
};

describe('FollowUpPanel (F3-F3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the due-for-followup list on mount', () => {
    const { followUpSend } = setup([]);

    expect(followUpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOAD_DUE_FOR_FOLLOWUP',
        doctorId: 'doctor-1',
        accessToken: 'token-123',
      }),
    );
  });

  it('renders one row per due patient with the recommended control date', () => {
    setup([
      due({ patientId: 'p1', patientName: 'John', patientSurname: 'Doe', scheduledFor: '2024-08-10' }),
      due({ patientId: 'p2', patientName: 'Jane', patientSurname: 'Roe', scheduledFor: '2024-09-15' }),
    ]);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Roe')).toBeInTheDocument();
    // recommended control date (scheduledFor) shown, formatted DD/MM/YYYY
    expect(screen.getByText(/10\/08\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/15\/09\/2024/)).toBeInTheDocument();
  });

  it('does NOT render any overdue chip, severity indicator or "atrasado" text (OQ-4)', () => {
    const { container } = setup([
      due({ patientId: 'p1', scheduledFor: '2020-01-01' }), // very old on purpose
    ]);

    // No MUI Chip anywhere in the panel
    expect(container.querySelector('.MuiChip-root')).toBeNull();
    // No overdue / severity wording
    expect(screen.queryByText(/atrasad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vencid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hace \d+ mes/i)).not.toBeInTheDocument();
  });

  it('opens the patient when its row action is clicked', () => {
    const { doctorSend } = setup([due({ patientId: 'p1', patientName: 'John', patientSurname: 'Doe' })]);

    fireEvent.click(screen.getByText('John Doe'));

    expect(doctorSend).toHaveBeenCalledWith({ type: 'SELECT_PATIENT', patientId: 'p1' });
  });

  it('navigates to the patient detail view on row click', () => {
    const { uiSend } = setup([due({ patientId: 'p1', patientName: 'John', patientSurname: 'Doe' })]);

    fireEvent.click(screen.getByText('John Doe'));

    expect(uiSend).toHaveBeenCalledWith({
      type: 'NAVIGATE',
      to: '/patient-detail?patientId=p1',
    });
  });

  it('renders the last visit date ("Última visita") when present', () => {
    setup([due({ patientId: 'p1', lastTurnDate: '2024-05-10T10:00:00Z' })]);

    expect(screen.getByText(/Última visita: 10\/05\/2024/)).toBeInTheDocument();
  });

  it('renders a dash for last visit when lastTurnDate is null (no "Invalid Date")', () => {
    setup([due({ patientId: 'p1', lastTurnDate: null })]);

    expect(screen.getByText(/Última visita: —/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders an empty state when no patients are due', () => {
    setup([]);

    expect(screen.getByText(/no hay pacientes con seguimiento pendiente/i)).toBeInTheDocument();
  });
});
