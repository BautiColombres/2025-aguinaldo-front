import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import ConfirmationModal from './ConfirmationModal';
import { useMachines } from '#/providers/MachineProvider';
import { useAuthMachine } from '#/providers/AuthProvider';
import { approveModifyRequest, rejectModifyRequest } from '#/utils/turnModificationsUtils';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

vi.mock('#/utils/turnModificationsUtils', () => ({
  approveModifyRequest: vi.fn(),
  rejectModifyRequest: vi.fn(),
}));

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: { send: vi.fn() },
}));

type Overrides = {
  confirmDialog?: Record<string, unknown>;
  accessToken?: string | undefined;
};

const setup = ({ confirmDialog = {}, accessToken = 'token-123' }: Overrides) => {
  const uiSend = vi.fn();
  const turnSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    uiState: {
      context: {
        confirmDialog: {
          open: true,
          title: 'Confirmar',
          message: 'Mensaje',
          confirmButtonText: 'Confirmar',
          ...confirmDialog,
        },
      },
    },
    uiSend,
    turnSend,
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: {
      context: {
        authResponse: accessToken ? { accessToken } : {},
      },
    },
  });

  render(<ConfirmationModal />);
  return { uiSend, turnSend };
};

describe('ConfirmationModal (FBUG-M2 / FBUG-M4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FBUG-M2: does not double-fire the async action on rapid double-click', async () => {
    let resolveApprove!: () => void;
    (approveModifyRequest as unknown as Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveApprove = resolve;
      }),
    );

    setup({ confirmDialog: { action: 'approve', requestId: 'req-1' } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(approveModifyRequest).toHaveBeenCalledTimes(1);

    resolveApprove();
    await waitFor(() => expect(approveModifyRequest).toHaveBeenCalledTimes(1));
  });

  it('FBUG-M2: keeps the modal open until the async action resolves', async () => {
    let resolveApprove!: () => void;
    (approveModifyRequest as unknown as Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveApprove = resolve;
      }),
    );

    const { uiSend } = setup({ confirmDialog: { action: 'approve', requestId: 'req-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Still pending -> modal must not be told to close yet.
    expect(uiSend).not.toHaveBeenCalledWith({ type: 'CLOSE_CONFIRMATION_DIALOG' });

    resolveApprove();

    await waitFor(() =>
      expect(uiSend).toHaveBeenCalledWith({ type: 'CLOSE_CONFIRMATION_DIALOG' }),
    );
  });

  it('FBUG-M4: guards against a missing access token (no crash, early return)', async () => {
    const { uiSend } = setup({
      confirmDialog: { action: 'approve', requestId: 'req-1' },
      accessToken: '',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(approveModifyRequest).not.toHaveBeenCalled();
    });
    expect(uiSend).not.toHaveBeenCalledWith({ type: 'CLOSE_CONFIRMATION_DIALOG' });
  });

  it('FBUG-M4: passes the access token (no non-null assertion crash) on reject', async () => {
    (rejectModifyRequest as unknown as Mock).mockResolvedValue(undefined);

    const { uiSend } = setup({
      confirmDialog: { action: 'reject', requestId: 'req-9' },
      accessToken: 'tok-9',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(rejectModifyRequest).toHaveBeenCalledWith('req-9', 'tok-9'));
    await waitFor(() =>
      expect(uiSend).toHaveBeenCalledWith({ type: 'CLOSE_CONFIRMATION_DIALOG' }),
    );
  });

  it('dispatches a synchronous turn action and closes the dialog', async () => {
    const { uiSend, turnSend } = setup({
      confirmDialog: { action: 'cancel_turn', turnId: 'turn-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(turnSend).toHaveBeenCalledWith({ type: 'CANCEL_TURN', turnId: 'turn-1' });
    await waitFor(() =>
      expect(uiSend).toHaveBeenCalledWith({ type: 'CLOSE_CONFIRMATION_DIALOG' }),
    );
  });
});
