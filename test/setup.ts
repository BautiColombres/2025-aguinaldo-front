import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount any mounted React trees after every test. @testing-library/react does
// this automatically, but its per-file auto-registration is unreliable when the
// whole suite shares one jsdom (the `--pool=forks --singleFork` mode this repo
// needs to avoid the worker-pool OOM/IPC crash): leftover DOM from one file then
// leaks into the next → "Found multiple elements" false failures. An explicit,
// idempotent afterEach(cleanup) guarantees isolation in every pool mode.
afterEach(() => {
  cleanup()
  // Restore real timers after every test. Several machine suites enable
  // `vi.useFakeTimers()` in their own beforeEach but never switch back; under the
  // shared-jsdom single-fork pool that leaks fake timers into the next file, where
  // Testing Library's `waitFor` (real setInterval polling) then hangs to the 5s test
  // timeout. Idempotent: a no-op when timers are already real, and each fake-timer
  // suite re-arms them in its own beforeEach.
  vi.useRealTimers()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))