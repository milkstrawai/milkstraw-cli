import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, ServerError } from '../../../../src/core/errors.js';
import { apiFetch, checkConnectivity, initializeApiTransport } from '../../../../src/lib/api/client.js';
import type { ApiTransport, TransportResponse } from '../../../../src/transport/types.js';

function createMockTransport(): ApiTransport & {
  fetch: ReturnType<typeof vi.fn>;
} {
  return {
    fetch: vi.fn(),
  };
}

function mockResponse(data: any, status = 200): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

let mockTransport: ReturnType<typeof createMockTransport>;

beforeEach(() => {
  mockTransport = createMockTransport();
  initializeApiTransport(mockTransport);
});

// ---------------------------------------------------------------------------
// apiFetch — delegation to transport
// ---------------------------------------------------------------------------
describe('apiFetch delegation', () => {
  it('delegates to transport.fetch with token when token is provided', async () => {
    mockTransport.fetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await apiFetch('/api/test', {}, 'my-token');

    expect(mockTransport.fetch).toHaveBeenCalledWith('/api/test', 'my-token', {
      method: undefined,
      body: undefined,
    });
  });

  it('delegates to transport.fetch with undefined token when no token', async () => {
    mockTransport.fetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await apiFetch('/api/test');

    expect(mockTransport.fetch).toHaveBeenCalledWith('/api/test', undefined, {
      method: undefined,
      body: undefined,
    });
  });

  it('passes object bodies through to transport unchanged', async () => {
    mockTransport.fetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await apiFetch('/api/test', { method: 'POST', body: { data: 1 } }, 'token');

    expect(mockTransport.fetch).toHaveBeenCalledWith('/api/test', 'token', {
      method: 'POST',
      body: { data: 1 },
    });
  });

  it('returns TransportResponse', async () => {
    const resp = mockResponse({ value: 42 });
    mockTransport.fetch.mockResolvedValueOnce(resp);

    const result = await apiFetch('/api/test');
    const data = await result.json();
    expect(data).toEqual({ value: 42 });
  });
});

// ---------------------------------------------------------------------------
// apiFetch — error propagation
// ---------------------------------------------------------------------------
describe('apiFetch error propagation', () => {
  it('propagates transport errors', async () => {
    mockTransport.fetch.mockRejectedValueOnce(new NetworkError('Connection failed'));
    await expect(apiFetch('/api/test')).rejects.toThrow(NetworkError);
  });

  it('propagates non-NetworkError errors', async () => {
    mockTransport.fetch.mockRejectedValueOnce(new Error('Unknown error'));
    await expect(apiFetch('/api/test')).rejects.toThrow('Unknown error');
  });
});

// ---------------------------------------------------------------------------
// checkConnectivity
// ---------------------------------------------------------------------------
describe('checkConnectivity', () => {
  it('succeeds when API returns ok', async () => {
    mockTransport.fetch.mockResolvedValueOnce(mockResponse({ templates: {} }));

    await expect(checkConnectivity()).resolves.toBeUndefined();

    expect(mockTransport.fetch).toHaveBeenCalledWith('/api/cloudformation/templates', undefined, { timeout: 5000 });
  });

  it('throws NetworkError with descriptive message when transport throws ServerError', async () => {
    mockTransport.fetch.mockRejectedValueOnce(new ServerError(500));
    await expect(checkConnectivity()).rejects.toThrow('MilkStraw API is experiencing issues. Try again later.');
  });

  it('throws NetworkError on connection failure', async () => {
    mockTransport.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(checkConnectivity()).rejects.toThrow(NetworkError);
  });

  it('re-throws existing NetworkError', async () => {
    mockTransport.fetch.mockRejectedValueOnce(new NetworkError('custom msg'));
    await expect(checkConnectivity()).rejects.toThrow('custom msg');
  });
});

// ---------------------------------------------------------------------------
// initializeApiTransport
// ---------------------------------------------------------------------------
describe('initializeApiTransport', () => {
  it('replaces the active transport when reinitialized', async () => {
    const firstTransport = createMockTransport();
    const secondTransport = createMockTransport();

    firstTransport.fetch.mockResolvedValueOnce(mockResponse({ first: true }));
    secondTransport.fetch.mockResolvedValueOnce(mockResponse({ second: true }));

    initializeApiTransport(firstTransport);
    const firstResponse = await apiFetch('/api/test');
    expect(await firstResponse.json()).toEqual({ first: true });
    expect(firstTransport.fetch).toHaveBeenCalledTimes(1);

    initializeApiTransport(secondTransport);
    const secondResponse = await apiFetch('/api/test');
    expect(await secondResponse.json()).toEqual({ second: true });
    expect(secondTransport.fetch).toHaveBeenCalledTimes(1);
  });
});
