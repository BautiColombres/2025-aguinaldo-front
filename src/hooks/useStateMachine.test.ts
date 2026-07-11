import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStateMachine } from './useStateMachine';
import { orchestrator } from '../core/Orchestrator';

// Mock the orchestrator
vi.mock('../core/Orchestrator', () => ({
  orchestrator: {
    sendToMachine: vi.fn(),
    getMachine: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

describe('useStateMachine', () => {
  const mockMachineId = 'test-machine';
  const mockSnapshot = { value: 'idle', context: {} };
  const mockMachine = {
    actor: {
      getSnapshot: vi.fn(),
      subscribe: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (orchestrator.getMachine as any).mockReturnValue(mockMachine);
    (orchestrator.getSnapshot as any).mockReturnValue(mockSnapshot);
    mockMachine.actor.getSnapshot.mockReturnValue(mockSnapshot);
    mockMachine.actor.subscribe.mockReturnValue({
      unsubscribe: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return initial state and send function', () => {
    const { result } = renderHook(() => useStateMachine(mockMachineId));

    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('send');
    expect(typeof result.current.send).toBe('function');
  });

  it('should initialize with snapshot from orchestrator', () => {
    const { result } = renderHook(() => useStateMachine(mockMachineId));

    expect(orchestrator.getSnapshot).toHaveBeenCalledWith(mockMachineId);
    expect(result.current.state).toEqual(mockSnapshot);
  });

  // FBUG-L1 — mounting must read/set the initial snapshot exactly once, not up to 3x.
  it('reads the initial snapshot only once on mount (FBUG-L1)', () => {
    renderHook(() => useStateMachine(mockMachineId));

    const orchestratorReads = (orchestrator.getSnapshot as any).mock.calls.length;
    const actorReads = mockMachine.actor.getSnapshot.mock.calls.length;

    expect(orchestratorReads + actorReads).toBe(1);
  });

  it('should call orchestrator.sendToMachine when send is called', () => {
    const { result } = renderHook(() => useStateMachine(mockMachineId));
    const testEvent = { type: 'TEST_EVENT', payload: 'test' };

    act(() => {
      result.current.send(testEvent);
    });

    expect(orchestrator.sendToMachine).toHaveBeenCalledWith(mockMachineId, testEvent);
  });

  it('should handle send errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (orchestrator.sendToMachine as any).mockImplementation(() => {
      throw new Error('Send failed');
    });

    const { result } = renderHook(() => useStateMachine(mockMachineId));
    const testEvent = { type: 'TEST_EVENT' };

    act(() => {
      result.current.send(testEvent);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to send event to machine ${mockMachineId}:`,
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should subscribe to machine state changes', () => {
    const mockSubscribe = vi.fn();
    const mockUnsubscribe = vi.fn();
    mockMachine.actor.subscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

    renderHook(() => useStateMachine(mockMachineId));

    expect(mockMachine.actor.subscribe).toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled(); // Should be called with callback
  });

  it('should update state when machine state changes', () => {
    const newSnapshot = { value: 'active', context: { data: 'updated' } };
    let subscriptionCallback: any;

    mockMachine.actor.subscribe.mockImplementation((callback) => {
      subscriptionCallback = callback;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => useStateMachine(mockMachineId));

    act(() => {
      subscriptionCallback(newSnapshot);
    });

    expect(result.current.state).toEqual(newSnapshot);
  });

  it('should handle missing machine gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (orchestrator.getMachine as any).mockReturnValue(null);

    renderHook(() => useStateMachine(mockMachineId));

    expect(consoleSpy).toHaveBeenCalledWith(
      `Machine with id "${mockMachineId}" is not registered`
    );

    consoleSpy.mockRestore();
  });

  it('should handle snapshot errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (orchestrator.getSnapshot as any).mockImplementation(() => {
      throw new Error('Snapshot error');
    });

    renderHook(() => useStateMachine(mockMachineId));

    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to get snapshot for machine ${mockMachineId}:`,
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should cleanup subscription on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockMachine.actor.subscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

    const { unmount } = renderHook(() => useStateMachine(mockMachineId));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should memoize send function', () => {
    const { result, rerender } = renderHook(() => useStateMachine(mockMachineId));

    const firstSend = result.current.send;
    rerender();
    const secondSend = result.current.send;

    expect(firstSend).toBe(secondSend);
  });
});