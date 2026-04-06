import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sleepMock } = vi.hoisted(() => ({
  sleepMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:timers/promises', () => ({
  setTimeout: sleepMock,
}));

import { BackendValidationError, NetworkError, RateLimitError, ServerError } from '../../../src/core/errors.js';
import { withRetry } from '../../../src/transport/retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    sleepMock.mockClear();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('retries on NetworkError', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new NetworkError()).mockResolvedValue('recovered');

    const result = await withRetry(fn, 3);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    // BASE_DELAY_MS * 2^0 = 1000, with jitter: 500-1000
    const delay = sleepMock.mock.calls[0][0];
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('retries on RateLimitError', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RateLimitError('Too fast', 2)).mockResolvedValue('ok');

    const result = await withRetry(fn, 3);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    // retryAfter * 1000 = 2000
    expect(sleepMock).toHaveBeenCalledWith(2000);
  });

  it('retries on ServerError', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ServerError(500)).mockResolvedValue('recovered');

    const result = await withRetry(fn, 3);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    // BASE_DELAY_MS * 2^0 = 1000, with jitter: 500-1000
    const delay = sleepMock.mock.calls[0][0];
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new BackendValidationError('invalid', 'Bad request'));

    await expect(withRetry(fn, 3)).rejects.toThrow('Bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError());

    await expect(withRetry(fn, 0)).rejects.toThrow(NetworkError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses Retry-After header for delay', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RateLimitError('Wait', 5)).mockResolvedValue('ok');

    const result = await withRetry(fn, 3);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    // retryAfter * 1000 = 5000
    expect(sleepMock).toHaveBeenCalledWith(5000);
  });
});
