import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import PatientDetails from './PatientDetails';
import { useMachines } from '#/providers/MachineProvider';
import { useDataMachine } from '#/providers/DataProvider';
import { useAuthMachine } from '#/providers/AuthProvider';
import type { MedicalHistory, TagFrequency } from '#/models/MedicalHistory';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/DataProvider', () => ({
  useDataMachine: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

const patient = {
  id: 'patient-1',
  name: 'John',
  surname: 'Doe',
  dni: '12345678',
  email: 'john@doe.com',
  status: 'active',
  birthdate: '1990-01-01',
  gender: 'male',
};

const turn = (id: string) => ({
  id,
  patientId: 'patient-1',
  scheduledAt: '2024-05-10T10:00:00Z',
  status: 'COMPLETED',
});

type SetupArgs = {
  medicalHistories?: MedicalHistory[];
  frequentTags?: TagFrequency[];
  selectedHistory?: Partial<MedicalHistory> | null;
  editingContent?: string;
  myTurns?: any[];
};

const setup = ({
  medicalHistories = [],
  frequentTags = [],
  selectedHistory = null,
  editingContent = '',
  myTurns = [turn('turn-1')],
}: SetupArgs = {}) => {
  const medicalHistorySend = vi.fn();
  const doctorSend = vi.fn();
  const dataSend = vi.fn();
  const followUpSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    doctorState: {
      context: {
        selectedPatient: patient,
        selectedPatientId: 'patient-1',
        patientSelectionAttempts: 0,
      },
      matches: vi.fn(() => false),
    },
    doctorSend,
    medicalHistoryState: {
      context: {
        medicalHistories,
        frequentTags,
        isLoading: false,
        selectedHistory,
        editingContent,
      },
    },
    medicalHistorySend,
    followUpState: {
      context: {
        dueReminders: [],
        patientReminders: [],
        isLoading: false,
        error: null,
      },
    },
    followUpSend,
  });

  (useDataMachine as unknown as Mock).mockReturnValue({
    dataState: {
      context: {
        myTurns,
        errors: { doctorPatients: null },
      },
    },
    dataSend,
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: {
      context: {
        authResponse: { accessToken: 'token-123', id: 'doctor-1' },
      },
    },
  });

  render(<PatientDetails />);
  return { medicalHistorySend, followUpSend };
};

const baseHistory = (over: Partial<MedicalHistory>): MedicalHistory => ({
  id: 'h1',
  content: 'Nota',
  createdAt: '2024-05-10T10:00:00Z',
  updatedAt: '2024-05-10T10:00:00Z',
  patientId: 'patient-1',
  patientName: 'John',
  patientSurname: 'Doe',
  doctorId: 'doctor-1',
  doctorName: 'Dr',
  doctorSurname: 'Who',
  turnId: 'turn-1',
  ...over,
});

describe('PatientDetails — tags (F1-F4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a chip when typing a tag and pressing Enter', async () => {
    const user = userEvent.setup();
    // Editing a turn with no existing history -> add flow
    setup({
      selectedHistory: { turnId: 'turn-1', content: '' } as MedicalHistory,
      editingContent: 'Consulta de control',
    });

    const input = screen.getByRole('combobox');
    await user.type(input, 'diabetes{enter}');

    expect(screen.getByText('diabetes')).toBeInTheDocument();
  });

  it('dispatches ADD_HISTORY_ENTRY_FOR_TURN with the typed tags on save', async () => {
    const user = userEvent.setup();
    const { medicalHistorySend } = setup({
      selectedHistory: { turnId: 'turn-1', content: '' } as MedicalHistory,
      editingContent: 'Consulta de control',
    });

    const input = screen.getByRole('combobox');
    await user.type(input, 'diabetes{enter}');

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(medicalHistorySend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_HISTORY_ENTRY_FOR_TURN',
        turnId: 'turn-1',
        content: 'Consulta de control',
        tags: ['diabetes'],
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      }),
    );
  });

  it('carries the existing tags through the edit/update path (does not drop them)', () => {
    const { medicalHistorySend } = setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1', tags: ['hipertensión'] })],
      selectedHistory: { turnId: 'turn-1', content: 'Nota' } as MedicalHistory,
      editingContent: 'Nota editada',
    });

    // The existing tag is pre-populated in the input
    expect(screen.getByText('hipertensión')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(medicalHistorySend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_HISTORY_ENTRY',
        historyId: 'h1',
        content: 'Nota editada',
        tags: ['hipertensión'],
      }),
    );
  });

  it('dispatches UPDATE_HISTORY_ENTRY with an empty tags array when all tags are removed', async () => {
    const user = userEvent.setup();
    const { medicalHistorySend } = setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1', tags: ['hipertensión'] })],
      selectedHistory: { turnId: 'turn-1', content: 'Nota' } as MedicalHistory,
      editingContent: 'Nota editada',
    });

    // The existing tag is pre-populated
    expect(screen.getByText('hipertensión')).toBeInTheDocument();

    // Remove the only chip via its delete (Cancel) icon
    const deleteIcon = document.querySelector('[data-testid="CancelIcon"]') as Element;
    await user.click(deleteIcon);

    expect(screen.queryByText('hipertensión')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(medicalHistorySend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_HISTORY_ENTRY',
        historyId: 'h1',
        content: 'Nota editada',
        tags: [],
      }),
    );
  });

  it('deduplicates tags entered twice via freeSolo', async () => {
    const user = userEvent.setup();
    const { medicalHistorySend } = setup({
      selectedHistory: { turnId: 'turn-1', content: '' } as MedicalHistory,
      editingContent: 'Consulta de control',
    });

    const input = screen.getByRole('combobox');
    await user.type(input, 'diabetes{enter}');
    // MUI treats ' diabetes ' as a distinct freeSolo value; only our handler
    // trims + dedupes it, so this collapses to a single chip after the fix.
    await user.type(input, ' diabetes {enter}');

    // Only one chip should remain
    expect(screen.getAllByText('diabetes')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(medicalHistorySend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_HISTORY_ENTRY_FOR_TURN',
        tags: ['diabetes'],
      }),
    );
  });

  it('enforces a client-side maximum of 10 tags', async () => {
    const user = userEvent.setup();
    const tenTags = Array.from({ length: 10 }, (_, i) => `tag${i}`);
    setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1', tags: tenTags })],
      selectedHistory: { turnId: 'turn-1', content: 'Nota' } as MedicalHistory,
      editingContent: 'Nota',
    });

    const input = screen.getByRole('combobox');
    await user.type(input, 'overflow{enter}');

    expect(screen.queryByText('overflow')).not.toBeInTheDocument();
    expect(screen.getByText('tag0')).toBeInTheDocument();
  });
});

describe('PatientDetails — frequent tags cloud (F1-F5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the frequent tags as chips ordered by count descending', () => {
    setup({
      frequentTags: [
        { tag: 'diabetes', count: 5 },
        { tag: 'gripe', count: 2 },
        { tag: 'control', count: 8 },
      ],
    });

    const section = screen.getByTestId('frequent-tags-section');
    const chips = within(section).getAllByTestId('frequent-tag-chip');
    const texts = chips.map((c) => c.textContent);

    expect(texts[0]).toContain('control');
    expect(texts[1]).toContain('diabetes');
    expect(texts[2]).toContain('gripe');
  });

  it('shows an empty state when there are no frequent tags', () => {
    setup({ frequentTags: [] });

    const section = screen.getByTestId('frequent-tags-section');
    expect(within(section).queryAllByTestId('frequent-tag-chip')).toHaveLength(0);
    expect(within(section).getByText(/No hay etiquetas frecuentes/i)).toBeInTheDocument();
  });
});

describe('PatientDetails — follow-up reminder ("Control en X meses") (F2-F4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the follow-up control selector only when a saved note exists for the turn', () => {
    setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1' })],
    });

    expect(screen.getByTestId('followup-section-turn-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear recordatorio/i })).toBeInTheDocument();
  });

  it('does not render the selector for a turn without a saved note', () => {
    setup({ medicalHistories: [] });

    expect(screen.queryByTestId('followup-section-turn-1')).not.toBeInTheDocument();
  });

  it('dispatches CREATE_FOLLOWUP with the default interval (3) and the note historyId', () => {
    const { followUpSend } = setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1' })],
    });

    fireEvent.click(screen.getByRole('button', { name: /Crear recordatorio/i }));

    expect(followUpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CREATE_FOLLOWUP',
        historyId: 'h1',
        months: 3,
        accessToken: 'token-123',
        doctorId: 'doctor-1',
      }),
    );
  });

  it('dispatches CREATE_FOLLOWUP with the selected interval (6 meses)', async () => {
    const user = userEvent.setup();
    const { followUpSend } = setup({
      medicalHistories: [baseHistory({ id: 'h1', turnId: 'turn-1' })],
    });

    await user.click(screen.getByRole('button', { name: /^6 meses$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear recordatorio/i }));

    expect(followUpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CREATE_FOLLOWUP',
        historyId: 'h1',
        months: 6,
      }),
    );
  });
});
