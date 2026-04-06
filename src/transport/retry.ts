import { setTimeout as sleep } from 'node:timers/promises';
import { NetworkError, RateLimitError, ServerError } from '../core/errors.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error)) throw error;
      if (attempt === maxRetries) throw error;

      const delay = getDelay(error, attempt);
      await sleep(delay);
    }
  }

  // Unreachable: loop always returns or throws, but TypeScript needs this
  throw new Error('Retry loop exited unexpectedly');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof ServerError) return true;

  return false;
}

function getDelay(error: unknown, attempt: number): number {
  if (error instanceof RateLimitError && error.retryAfter) {
    return Math.min(error.retryAfter * 1000, 60_000);
  }

  const delay = BASE_DELAY_MS * 2 ** attempt;
  const jitter = delay * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}
