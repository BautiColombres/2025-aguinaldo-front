import { createActor, type AnyStateMachine, type AnyActor } from 'xstate';
import { logger } from '../utils/logger';

// FSEC-L1 — never let token-bearing event payloads reach the console, even in dev.
// Any key matching a sensitive name is replaced before logging; the original event
// object is left untouched (a redacted copy is produced).
const REDACTED = '[REDACTED]';
// FSEC-L1 — substring/pattern match (not exact) so that camelCase, snake_case and
// prefixed/suffixed variants are all covered: newPassword, currentPassword,
// confirmPassword, access_token, refresh_token, authorization, apiKey, etc.
const SENSITIVE_KEY_PATTERNS = [
  'token',
  'password',
  'secret',
  'authorization',
  'bearer',
  'apikey',
  'credential',
  'jwt',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function redactTokens(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactTokens);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactTokens(val);
    }
    return out;
  }
  return value;
}

type EventListener<T = any> = (event: T) => void;

interface EventSubscription {
  unsubscribe: () => void;
}

interface MachineRegistration {
  id: string;
  machine: AnyStateMachine;
  eventTypes: string[];
  input?: any;
}

interface RegisteredMachine {
  id: string;
  machine: AnyStateMachine;
  actor: AnyActor;
  eventTypes: string[];
  subscriptions: EventSubscription[];
  registration: MachineRegistration;
}

export class Orchestrator {
  private eventListeners: Map<string, Set<EventListener>> = new Map();
  private machines: Map<string, RegisteredMachine> = new Map();
  private debug: boolean = false;

  constructor(options?: { debug?: boolean }) {
    // FSEC-L1 — debug logging is force-disabled outside a DEV build so token-bearing
    // events can never be logged in production, regardless of the `debug` option.
    this.debug = Boolean(options?.debug) && Boolean(import.meta.env.DEV);
  }

  registerMachine(registration: MachineRegistration): void {
    const { id, machine, eventTypes, input } = registration;

    if (this.machines.has(id)) {
      if (this.debug) {
        logger.warn(`[Orchestrator] Machine with id "${id}" is already registered. Skipping registration.`);
      }
      return;
    }

    let actor: AnyActor;
    
    try {
      actor = createActor(machine, input ? { input } : undefined);
    } catch (error) {
      throw new Error(`Failed to create actor for machine "${id}": ${error}`);
    }

    const subscriptions: EventSubscription[] = [];
    
    eventTypes.forEach(eventType => {
      const subscription = this.subscribe(eventType, (event) => {
        if (this.debug) {
          logger.log(`[Orchestrator] Sending event "${eventType}" to machine "${id}":`, redactTokens(event));
        }
        actor.send(event);
      });
      subscriptions.push(subscription);
    });

    this.machines.set(id, {
      id,
      machine,
      actor,
      eventTypes,
      subscriptions,
      registration
    });

    actor.start();

    if (this.debug) {
      logger.log(`[Orchestrator] Registered machine "${id}" with event types:`, eventTypes);
    }

    this.emit('MACHINE_REGISTERED', { machineId: id, eventTypes });
  }


  unregisterMachine(id: string): void {
    const registeredMachine = this.machines.get(id);
    if (!registeredMachine) {
      throw new Error(`Machine with id "${id}" is not registered`);
    }

    registeredMachine.subscriptions.forEach(sub => sub.unsubscribe());

    registeredMachine.actor.stop();

    this.machines.delete(id);

    if (this.debug) {
      logger.log(`[Orchestrator] Unregistered machine "${id}"`);
    }

    this.emit('MACHINE_UNREGISTERED', { machineId: id });
  }

  getMachine(id: string): RegisteredMachine | undefined {
    return this.machines.get(id);
  }


  getMachineIds(): string[] {
    return Array.from(this.machines.keys());
  }

  send(event: any): void {
    if (this.debug) {
      logger.log(`[Orchestrator] Broadcasting event to all machines:`, redactTokens(event));
    }

    this.emit(event.type, event);
  }

  sendToMachine(machineId: string, event: any): void {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine with id "${machineId}" is not registered`);
    }

    if (this.debug) {
      logger.log(`[Orchestrator] Sending event to machine "${machineId}":`, redactTokens(event));
    }

    machine.actor.send(event);
  }

  getSnapshot(machineId: string): any {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine with id "${machineId}" is not registered`);
    }

    return machine.actor.getSnapshot();
  }

  getMachineEventTypes(machineId: string): string[] {
    const machine = this.machines.get(machineId);
    if (!machine) {
      throw new Error(`Machine with id "${machineId}" is not registered`);
    }

    return machine.eventTypes;
  }

  subscribe<T = any>(eventType: string, listener: EventListener<T>): EventSubscription {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(listener);

    return {
      unsubscribe: () => {
        const typeListeners = this.eventListeners.get(eventType);
        if (typeListeners) {
          typeListeners.delete(listener);
          if (typeListeners.size === 0) {
            this.eventListeners.delete(eventType);
          }
        }
      }
    };
  }

  emit<T = any>(eventType: string, event: T): void {
    if (this.debug) {
      logger.log(`[Orchestrator] Emitting event "${eventType}":`, redactTokens(event));
    }

    const typeListeners = this.eventListeners.get(eventType);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          // FSEC-L1 — route through the DEV-gated logger so listener errors never
          // reach the raw console in a production build.
          logger.error(`[Orchestrator] Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  getEventTypes(): string[] {
    return Array.from(this.eventListeners.keys());
  }

  destroy(): void {
    const machineIds = Array.from(this.machines.keys());
    machineIds.forEach(id => this.unregisterMachine(id));

    this.eventListeners.clear();

    if (this.debug) {
      logger.log('[Orchestrator] Destroyed');
    }
  }
}

export const orchestrator = new Orchestrator();
