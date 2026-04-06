import { describe, expect, it } from 'vitest';
import {
  AuthRequiredError,
  CliError,
  ConfigError,
  NetworkError,
  PartialSuccessError,
  PermissionError,
  RateLimitError,
  ServerError,
  UsageError,
} from '../../../src/core/errors.js';
import {
  EXIT_AUTH,
  EXIT_AWS_CREDENTIALS,
  EXIT_AWS_DEPLOYMENT,
  EXIT_BACKEND_VALIDATION,
  EXIT_CONFIG,
  EXIT_GENERAL,
  EXIT_NETWORK,
  EXIT_PARTIAL,
  EXIT_PERMISSION,
  EXIT_RATE_LIMIT,
  EXIT_SERVER,
  EXIT_SUCCESS,
  EXIT_USAGE,
  exitCodeFromError,
} from '../../../src/core/exit-codes.js';

describe('exit-codes', () => {
  describe('constants', () => {
    it('has correct exit code values', () => {
      expect(EXIT_SUCCESS).toBe(0);
      expect(EXIT_GENERAL).toBe(1);
      expect(EXIT_USAGE).toBe(2);
      expect(EXIT_CONFIG).toBe(3);
      expect(EXIT_AUTH).toBe(4);
      expect(EXIT_PERMISSION).toBe(5);
      expect(EXIT_AWS_CREDENTIALS).toBe(6);
      expect(EXIT_NETWORK).toBe(7);
      expect(EXIT_RATE_LIMIT).toBe(8);
      expect(EXIT_BACKEND_VALIDATION).toBe(9);
      expect(EXIT_AWS_DEPLOYMENT).toBe(10);
      expect(EXIT_PARTIAL).toBe(11);
      expect(EXIT_SERVER).toBe(12);
    });
  });

  describe('exitCodeFromError', () => {
    it('returns the exit code from a CliError', () => {
      expect(exitCodeFromError(new CliError('fail', 42))).toBe(42);
    });

    it('returns the exit code from specific error subclasses', () => {
      expect(exitCodeFromError(new UsageError('bad'))).toBe(EXIT_USAGE);
      expect(exitCodeFromError(new ConfigError('bad'))).toBe(EXIT_CONFIG);
      expect(exitCodeFromError(new AuthRequiredError())).toBe(EXIT_AUTH);
      expect(exitCodeFromError(new PermissionError('denied'))).toBe(EXIT_PERMISSION);
      expect(exitCodeFromError(new NetworkError())).toBe(EXIT_NETWORK);
      expect(exitCodeFromError(new RateLimitError())).toBe(EXIT_RATE_LIMIT);
      expect(exitCodeFromError(new PartialSuccessError('partial', 1, 1))).toBe(EXIT_PARTIAL);
      expect(exitCodeFromError(new ServerError(500))).toBe(EXIT_SERVER);
    });

    it('returns EXIT_GENERAL for non-CliError values', () => {
      expect(exitCodeFromError(new Error('generic'))).toBe(EXIT_GENERAL);
      expect(exitCodeFromError('string error')).toBe(EXIT_GENERAL);
      expect(exitCodeFromError(null)).toBe(EXIT_GENERAL);
    });
  });
});
