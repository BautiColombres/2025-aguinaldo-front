import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';


describe('logger (FSEC-M2)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('in production (import.meta.env.DEV === false)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', false);
    });

    it('logger.error is a no-op', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('backend failure', { email: 'patient@example.com' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('logger.warn is a no-op', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning');
      expect(spy).not.toHaveBeenCalled();
    });

    it('logger.info is a no-op', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info');
      expect(spy).not.toHaveBeenCalled();
    });

    it('logger.debug is a no-op', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('debug');
      expect(spy).not.toHaveBeenCalled();
    });

    it('logger.log is a no-op', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('log');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('in development (import.meta.env.DEV === true)', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('logger.error forwards to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('boom', 42);
      expect(spy).toHaveBeenCalledWith('boom', 42);
    });

    it('logger.warn forwards to console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('careful');
      expect(spy).toHaveBeenCalledWith('careful');
    });

    it('logger.info forwards to console.info', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('fyi');
      expect(spy).toHaveBeenCalledWith('fyi');
    });

    it('logger.debug forwards to console.debug', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('trace');
      expect(spy).toHaveBeenCalledWith('trace');
    });

    it('logger.log forwards to console.log', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('hello');
      expect(spy).toHaveBeenCalledWith('hello');
    });
  });
});
