// FSEC-M2 — Dev-only logger.
// In production (import.meta.env.DEV === false) every method is a no-op, so
// backend error text / PII never reaches the browser console. `import.meta.env.DEV`
// is read at call time (not module load) so behaviour tracks the current env.
// Prefer these over raw console.* in the service layer; keep user-facing messages
// generic and route diagnostics here.

type LogArgs = unknown[];

const isDev = (): boolean => Boolean(import.meta.env.DEV);

export const logger = {
  error: (...args: LogArgs): void => {
    if (isDev()) {
      console.error(...args);
    }
  },
  warn: (...args: LogArgs): void => {
    if (isDev()) {
      console.warn(...args);
    }
  },
  info: (...args: LogArgs): void => {
    if (isDev()) {
      console.info(...args);
    }
  },
  debug: (...args: LogArgs): void => {
    if (isDev()) {
      console.debug(...args);
    }
  },
  log: (...args: LogArgs): void => {
    if (isDev()) {
      console.log(...args);
    }
  },
};
