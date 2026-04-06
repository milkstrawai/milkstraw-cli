import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthRequiredError,
  BackendValidationError,
  NetworkError,
  PermissionError,
  RateLimitError,
  ServerError,
} from '../../../src/core/errors.js';
import { createTransport, type TransportConfig } from '../../../src/transport/client.js';

// Mock retry to pass-through
vi.mock('../../../src/transport/retry.js', () => ({
  withRetry: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

describe('createTransport', () => {
  const originalFetch = globalThis.fetch;

  const baseConfig: TransportConfig = {
    baseUrl: 'https://api.test.com',
    userAgent: 'test-cli/1.0',
    timeout: 5000,
    verbose: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes GET request with correct headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const transport = createTransport(baseConfig);
    await transport.fetch('/api/test');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'User-Agent': 'test-cli/1.0',
        }),
      }),
    );
  });

  it('injects auth header when token is provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const transport = createTransport(baseConfig);
    await transport.fetch('/api/test', 'my-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('sends JSON body for POST requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const transport = createTransport(baseConfig);
    await transport.fetch('/api/test', undefined, { method: 'POST', body: { key: 'value' } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/test',
      expect.objectContaining({
        method: 'POST',
        body: '{"key":"value"}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws NetworkError on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('network'));

    const transport = createTransport(baseConfig);
    await expect(transport.fetch('/api/test')).rejects.toThrow(NetworkError);
  });

  it('throws AuthRequiredError on 401', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized', message: 'Bad token' }), { status: 401 }),
      );

    const transport = createTransport(baseConfig);
    await expect(transport.fetch('/api/test')).rejects.toThrow(AuthRequiredError);
  });

  it('throws PermissionError on 403', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'forbidden', message: 'No access' }), { status: 403 }));

    const transport = createTransport(baseConfig);
    await expect(transport.fetch('/api/test')).rejects.toThrow(PermissionError);
  });

  it('throws RateLimitError on 429 with Retry-After', async () => {
    const headers = new Headers({ 'Retry-After': '30' });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Slow down' }), { status: 429, headers }));

    const transport = createTransport(baseConfig);
    try {
      await transport.fetch('/api/test');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBe(30);
    }
  });

  it('throws ServerError on 500', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'internal', message: 'Internal server error' }), { status: 500 }),
      );

    const transport = createTransport(baseConfig);
    const error = await transport.fetch('/api/test').catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect((error as ServerError).statusCode).toBe(500);
  });

  it('throws ServerError on 502', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }));

    const transport = createTransport(baseConfig);
    const error = await transport.fetch('/api/test').catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect((error as ServerError).statusCode).toBe(502);
  });

  it('throws BackendValidationError on 4xx client errors', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'validation', message: 'Invalid input' }), { status: 422 }),
      );

    const transport = createTransport(baseConfig);
    await expect(transport.fetch('/api/test')).rejects.toThrow(BackendValidationError);
  });

  it('logs verbose output to stderr', async () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    const transport = createTransport({ ...baseConfig, verbose: true });
    await transport.fetch('/api/test');

    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('[transport] GET'));
    stderrWrite.mockRestore();
  });
});
