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
