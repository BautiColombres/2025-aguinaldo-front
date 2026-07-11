import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import DoctorMetrics from './DoctorMetrics';
import { useMachines } from '#/providers/MachineProvider';
import { useAuthMachine } from '#/providers/AuthProvider';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

const baseMetrics = {
  doctorId: 'doc-1',
  name: 'Ada',
  surname: 'Lovelace',
  specialty: 'Cardiología',
  score: 0,
  ratingSubcategories: [],
  totalPatients: 3,
  upcomingTurns: 2,
  completedTurnsThisMonth: 5,
  cancelledTurns: 1,
};

const renderWithMetrics = (metricsOverride: Record<string, unknown>) => {
  (useMachines as unknown as Mock).mockReturnValue({
    doctorState: {
      context: {
        accessToken: 'token',
        doctorId: 'doc-1',
        isLoadingMetrics: false,
        metrics: { ...baseMetrics, ...metricsOverride },
        metricsError: null,
      },
    },
    doctorSend: vi.fn(),
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: {
      context: {
        authResponse: { name: 'Ada' },
      },
    },
  });

  return render(<DoctorMetrics />);
};

describe('DoctorMetrics (FBUG-M1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a real score of 0 as 0.00, not N/A', () => {
    renderWithMetrics({ score: 0 });

    expect(screen.getByText(/0\.00 \/ 5\.0/)).toBeInTheDocument();
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
  });

  it('renders N/A when score is null', () => {
    renderWithMetrics({ score: null });

    expect(screen.getByText(/N\/A \/ 5\.0/)).toBeInTheDocument();
  });

  it('formats a non-zero score with two decimals', () => {
    renderWithMetrics({ score: 4.5 });

    expect(screen.getByText(/4\.50 \/ 5\.0/)).toBeInTheDocument();
  });
});
