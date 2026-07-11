import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import LoginScreen from './LoginScreen';
import { useMachines } from '#/providers/MachineProvider';
import { useAuthMachine } from '#/providers/AuthProvider';

vi.mock('#/providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

vi.mock('#/providers/AuthProvider', () => ({
  useAuthMachine: vi.fn(),
}));

type AuthOverrides = {
  loading?: boolean;
  hasErrorsOrEmpty?: boolean;
  value?: string;
};

const setup = ({ loading = false, hasErrorsOrEmpty = false, value = 'idle' }: AuthOverrides) => {
  const authSend = vi.fn();
  const uiSend = vi.fn();

  (useMachines as unknown as Mock).mockReturnValue({
    uiState: { context: { toggleStates: {} } },
    uiSend,
  });

  (useAuthMachine as unknown as Mock).mockReturnValue({
    authState: {
      value,
      context: {
        loading,
        hasErrorsOrEmpty,
        isAuthenticated: false,
        formValues: { email: 'a@b.com', password: 'secret' },
        formErrors: {},
        authResponse: null,
      },
    },
    authSend,
  });

  const view = render(<LoginScreen />);
  return { authSend, uiSend, view };
};

describe('LoginScreen (FBUG-M3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables the submit button while a submit is in flight (loading)', () => {
    setup({ loading: true });

    const submit = screen.getByRole('button', { name: /iniciando sesión/i });
    expect(submit).toBeDisabled();
  });

  it('does not dispatch SUBMIT again while already submitting', () => {
    const { authSend, view } = setup({ loading: true });

    const form = view.container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(authSend).not.toHaveBeenCalledWith({ type: 'SUBMIT' });
  });

  it('dispatches SUBMIT when idle and the form is valid', () => {
    const { authSend, view } = setup({ loading: false, hasErrorsOrEmpty: false });

    const form = view.container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(authSend).toHaveBeenCalledWith({ type: 'SUBMIT' });
  });
});
