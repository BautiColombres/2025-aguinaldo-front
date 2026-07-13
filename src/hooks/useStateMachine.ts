import { orchestrator } from '../core/Orchestrator';
import React from 'react';

interface UseStateMachineReturn {
  state: any;
  send: (event: any) => void;
}

export function useStateMachine(machineId: string): UseStateMachineReturn {
  const [snapshot, setSnapshot] = React.useState<any>(null);

  const send = React.useCallback((event: any) => {
    try {
      orchestrator.sendToMachine(machineId, event);
    } catch (err) {
      console.error(`Failed to send event to machine ${machineId}:`, err);
    }
  }, [machineId]);

  const updateSnapshot = React.useCallback(() => {
    try {
      const machine = orchestrator.getMachine(machineId);
      if (!machine) {
        console.error(`Machine with id "${machineId}" is not registered`);
        return;
      }

      const currentSnapshot = orchestrator.getSnapshot(machineId);
      setSnapshot(currentSnapshot);
    } catch (err) {
      console.error(`Failed to get snapshot for machine ${machineId}:`, err);
    }
  }, [machineId]);

  React.useEffect(() => {
    const machine = orchestrator.getMachine(machineId);
    if (!machine) {
      console.warn(`Machine with id "${machineId}" is not registered`);
      return;
    }

    updateSnapshot();

    const subscription = machine.actor.subscribe((state: any) => {
      setSnapshot(state);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [machineId, updateSnapshot]);

  return {
    state: snapshot,
    send
  };
}