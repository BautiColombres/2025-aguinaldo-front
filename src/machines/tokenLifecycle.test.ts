import { describe, it, expect, vi } from 'vitest';
import { createActor, type AnyStateMachine } from 'xstate';

// FSEC / FBUG-003 — token lifecycle contract, enforced across EVERY machine.
//
// Two invariants that are easy to break silently when a machine is added:
//
//  1. CLEAR_ACCESS_TOKEN must null the in-memory bearer in EVERY machine that holds
//     one. `authMachine` broadcasts it on LOGOUT and on SESSION_EXPIRED, but a
//     machine that neither lists the event in its *_EVENT_TYPES (the orchestrator
//     only forwards listed events) nor handles it keeps a LIVE credential in context
//     after "logout" — and in the retry-401 path that credential is a FRESHLY minted,
//     cryptographically valid token, while the UI claims the user is logged out.
//
//  2. TOKEN_REFRESHED must be adopted in place (pure assign) by every machine that
//     holds a token, so a silent refresh does not leave stale tokens behind
//     (which would 401 → refresh → 401 forever).
//
// This suite fails if a token-holding machine forgets either wiring.

import { authMachine, AUTH_MACHINE_EVENT_TYPES } from './authMachine';
import { dataMachine, DATA_MACHINE_EVENT_TYPES } from './dataMachine';
import doctorMachine, { DOCTOR_MACHINE_EVENT_TYPES } from './doctorMachine';
import { filesMachine, FILES_MACHINE_EVENT_TYPES } from './filesMachine';
import badgeMachine, { BADGE_MACHINE_EVENT_TYPES } from './badgeMachine';
import { profileMachine, PROFILE_MACHINE_EVENT_TYPES } from './profileMachine';
import { turnMachine, TURN_MACHINE_EVENT_TYPES } from './turnMachine';
import { notificationMachine, NOTIFICATION_MACHINE_EVENT_TYPES } from './notificationMachine';
import { medicalHistoryMachine, MEDICAL_HISTORY_MACHINE_EVENT_TYPES } from './medicalHistoryMachine';
import { followUpMachine, FOLLOW_UP_MACHINE_EVENT_TYPES } from './followUpMachine';
import { ratingMachine, RATING_MACHINE_EVENT_TYPES } from './ratingMachine';

vi.mock('#/core/Orchestrator', () => ({
  orchestrator: {
    send: vi.fn(),
    sendToMachine: vi.fn(),
    getSnapshot: vi.fn(() => ({ context: {} })),
  },
}));

vi.mock('../utils/MachineUtils/authMachineUtils', () => ({
  checkStoredAuth: vi.fn().mockResolvedValue({ authData: null, isAuthenticated: false }),
  submitAuthentication: vi.fn(),
  logoutUser: vi.fn(),
}));

interface MachineUnderTest {
  name: string;
  machine: AnyStateMachine;
  eventTypes: string[];
}

const ALL_MACHINES: MachineUnderTest[] = [
  { name: 'auth', machine: authMachine, eventTypes: AUTH_MACHINE_EVENT_TYPES },
  { name: 'data', machine: dataMachine, eventTypes: DATA_MACHINE_EVENT_TYPES },
  { name: 'doctor', machine: doctorMachine, eventTypes: DOCTOR_MACHINE_EVENT_TYPES },
  { name: 'files', machine: filesMachine, eventTypes: FILES_MACHINE_EVENT_TYPES },
  { name: 'badge', machine: badgeMachine, eventTypes: BADGE_MACHINE_EVENT_TYPES },
  { name: 'profile', machine: profileMachine, eventTypes: PROFILE_MACHINE_EVENT_TYPES },
  { name: 'turn', machine: turnMachine, eventTypes: TURN_MACHINE_EVENT_TYPES },
  { name: 'notification', machine: notificationMachine, eventTypes: NOTIFICATION_MACHINE_EVENT_TYPES },
  { name: 'medicalHistory', machine: medicalHistoryMachine, eventTypes: MEDICAL_HISTORY_MACHINE_EVENT_TYPES },
  { name: 'followUp', machine: followUpMachine, eventTypes: FOLLOW_UP_MACHINE_EVENT_TYPES },
  { name: 'rating', machine: ratingMachine, eventTypes: RATING_MACHINE_EVENT_TYPES },
];

const initialContextOf = (machine: AnyStateMachine): Record<string, unknown> => {
  const actor = createActor(machine);
  actor.start();
  const context = actor.getSnapshot().context as Record<string, unknown>;
  actor.stop();
  return context ?? {};
};

/** Machines that keep an access token in context — the ones the invariants apply to. */
const TOKEN_HOLDERS = ALL_MACHINES.filter((m) => 'accessToken' in initialContextOf(m.machine));

describe('token lifecycle across machines (FSEC / FBUG-003)', () => {
  it('detects the token-holding machines (guards against a silent import drop)', () => {
    expect(TOKEN_HOLDERS.map((m) => m.name).sort()).toEqual(
      [
        'badge',
        'data',
        'doctor',
        'files',
        'followUp',
        'medicalHistory',
        'notification',
        'profile',
        'turn',
      ].sort(),
    );
  });

  describe.each(TOKEN_HOLDERS)('$name machine', ({ machine, eventTypes }) => {
    // The orchestrator only forwards the events a machine declares.
    it('subscribes to CLEAR_ACCESS_TOKEN', () => {
      expect(eventTypes).toContain('CLEAR_ACCESS_TOKEN');
    });

    it('subscribes to TOKEN_REFRESHED', () => {
      expect(eventTypes).toContain('TOKEN_REFRESHED');
    });

    it('handles CLEAR_ACCESS_TOKEN in its initial state', () => {
      expect(createActor(machine).getSnapshot().can({ type: 'CLEAR_ACCESS_TOKEN' })).toBe(true);
    });

    it('handles TOKEN_REFRESHED in its initial state', () => {
      expect(
        createActor(machine)
          .getSnapshot()
          .can({ type: 'TOKEN_REFRESHED', accessToken: 'x' }),
      ).toBe(true);
    });

    it('nulls the in-memory access token on CLEAR_ACCESS_TOKEN', () => {
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: 'TOKEN_REFRESHED', accessToken: 'live-bearer-token' });
      expect(actor.getSnapshot().context.accessToken).toBe('live-bearer-token');

      actor.send({ type: 'CLEAR_ACCESS_TOKEN' });
      expect(actor.getSnapshot().context.accessToken).toBeNull();

      actor.stop();
    });

    it('adopts a refreshed token in place', () => {
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: 'TOKEN_REFRESHED', accessToken: 'token-1' });
      actor.send({ type: 'TOKEN_REFRESHED', accessToken: 'token-2' });

      expect(actor.getSnapshot().context.accessToken).toBe('token-2');

      actor.stop();
    });
  });

  // The interceptor's TOKEN_REFRESHED must NOT re-bootstrap an established session:
  // dataMachine treats SET_AUTH as "a session just started" and flips
  // loading.initializing, which remounts the dashboards (killing open dialogs and
  // in-progress forms) and fires a refetch storm on every silent refresh.
  it('a silent refresh does not flip dataMachine into its initializing/bootstrap path', () => {
    const actor = createActor(dataMachine);
    actor.start();

    const before = actor.getSnapshot();

    actor.send({ type: 'TOKEN_REFRESHED', accessToken: 'refreshed-token' });

    const after = actor.getSnapshot();
    expect(after.context.accessToken).toBe('refreshed-token');
    expect(after.context.loading.initializing).toBe(false);
    // no state change: pure assign, no target, no refetch
    expect(after.value).toEqual(before.value);

    actor.stop();
  });
});
