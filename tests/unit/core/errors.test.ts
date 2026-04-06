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
import { exitCodeFromError } from '../../../src/core/exit-codes.js';

describe('error hierarchy', () => {
  it('CliError has exit code', () => {
    expect(new CliError('test', 5).exitCode).toBe(5);
  });

  it('UsageError has exit code 2', () => {
    expect(new UsageError('bad input').exitCode).toBe(2);
  });

  it('ConfigError has exit code 3', () => {
    expect(new ConfigError('bad config').exitCode).toBe(3);
  });

  it('AuthRequiredError has exit code 4', () => {
    expect(new AuthRequiredError().exitCode).toBe(4);
  });

  it('PermissionError has exit code 5 and org info', () => {
    const error = new PermissionError('denied', { organizationId: 'org_1', organizationName: 'Acme' });
    expect(error.exitCode).toBe(5);
    expect(error.organizationId).toBe('org_1');
    expect(error.organizationName).toBe('Acme');
  });

  it('NetworkError has exit code 7', () => {
    expect(new NetworkError().exitCode).toBe(7);
  });

  it('RateLimitError stores retryAfter', () => {
    const error = new RateLimitError('wait', 30);
    expect(error.retryAfter).toBe(30);
    expect(error.exitCode).toBe(8);
  });

  it('PartialSuccessError has counts', () => {
    const error = new PartialSuccessError('some failed', 5, 2);
    expect(error.succeeded).toBe(5);
    expect(error.failed).toBe(2);
    expect(error.exitCode).toBe(11);
  });

  it('ServerError has exit code 12 and statusCode', () => {
    const error = new ServerError(502, 'Bad Gateway');
    expect(error.exitCode).toBe(12);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Bad Gateway');
  });

  it('ServerError uses default message', () => {
    const error = new ServerError(500);
    expect(error.message).toBe('MilkStraw API is experiencing issues. Try again later.');
  });
});

describe('exitCodeFromError', () => {
  it('maps CliError to its exit code', () => {
    expect(exitCodeFromError(new AuthRequiredError())).toBe(4);
    expect(exitCodeFromError(new NetworkError())).toBe(7);
  });

  it('returns 1 for unknown errors', () => {
    expect(exitCodeFromError(new Error('unknown'))).toBe(1);
  });
});
