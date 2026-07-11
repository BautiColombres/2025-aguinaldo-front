import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SnackbarAlert from './SnackbarAlert';

// Mock the machines provider so we can drive the snackbar context directly.
vi.mock('../../../providers/MachineProvider', () => ({
  useMachines: vi.fn(),
}));

import { useMachines } from '../../../providers/MachineProvider';

describe('SnackbarAlert (FBUG-L4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (open: boolean) => {
    const uiSend = vi.fn();
    (useMachines as any).mockReturnValue({
      uiState: { context: { snackbar: { open, message: 'Hola', severity: 'info' } } },
      uiSend,
    });
    render(<SnackbarAlert />);
    return uiSend;
  };

  it('auto-hides after 6s via MUI autoHideDuration and sends CLOSE_SNACKBAR', () => {
    const uiSend = setup(true);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(uiSend).toHaveBeenCalledWith({ type: 'CLOSE_SNACKBAR' });
  });

  it('does not send CLOSE_SNACKBAR before the auto-hide duration elapses', () => {
    const uiSend = setup(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(uiSend).not.toHaveBeenCalled();
  });
});
