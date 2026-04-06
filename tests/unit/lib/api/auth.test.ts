import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendValidationError, NetworkError } from '../../../../src/core/errors.js';

// Mock the sleep to resolve immediately so tests don't need fake timers
vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

// Mock client.ts to provide a controllable apiFetch
const mockApiFetch = vi.fn();
vi.mock('../../../../src/lib/api/client.js', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  initializeApiTransport: vi.fn(),
}));

const { requestDeviceCode, pollForToken, revokeToken } = await import('../../../../src/lib/api/auth.js');

function mockResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {},
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

// ---------------------------------------------------------------------------
// requestDeviceCode
// ---------------------------------------------------------------------------
describe('requestDeviceCode', () => {
  it('returns device code response', async () => {
    const deviceCode = {
      device_code: 'abc123',
      user_code: 'USER-CODE',
      verification_url: 'https://app.milkstraw.ai/device',
      expires_in: 900,
      interval: 5,
    };
    mockApiFetch.mockResolvedValueOnce(mockResponse(deviceCode));

    const result = await requestDeviceCode();
    expect(result).toEqual({
      deviceCode: 'abc123',
      userCode: 'USER-CODE',
      verificationUrl: 'https://app.milkstraw.ai/device',
      expiresIn: 900,
      interval: 5,
    });
  });

  it('calls the correct endpoint with POST', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse({ device_code: 'x' }));

    await requestDeviceCode();

    expect(mockApiFetch).toHaveBeenCalledWith('/api/oauth/device_codes', {
      method: 'POST',
      body: {},
    });
  });

  it('throws when apiFetch throws', async () => {
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('rate_limited', 'Too many'));
    await expect(requestDeviceCode()).rejects.toThrow(BackendValidationError);
  });

  it('throws NetworkError on connection failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new NetworkError());
    await expect(requestDeviceCode()).rejects.toThrow(NetworkError);
  });
});

// ---------------------------------------------------------------------------
// pollForToken
// ---------------------------------------------------------------------------
describe('pollForToken', () => {
  it('returns token after authorization_pending', async () => {
    mockApiFetch
      .mockRejectedValueOnce(new BackendValidationError('authorization_pending', 'Waiting'))
      .mockResolvedValueOnce(
        mockResponse({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 7776000,
          user: { email: 'test@example.com' },
        }),
      );

    const result = await pollForToken('device-code', 1, 900);
    expect(result.accessToken).toBe('test-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('sends correct body with device_code and grant_type', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse({
        access_token: 'tok',
        token_type: 'Bearer',
        expires_in: 100,
      }),
    );

    await pollForToken('my-device-code', 1, 900);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/oauth/token', {
      method: 'POST',
      body: expect.objectContaining({
        device_code: 'my-device-code',
      }),
    });
    const body = mockApiFetch.mock.calls[0][1].body;
    expect(body.grant_type).toBe('urn:ietf:params:oauth:grant-type:device_code');
  });

  it('handles slow_down by increasing interval', async () => {
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('slow_down', 'Slow down')).mockResolvedValueOnce(
      mockResponse({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 7776000,
      }),
    );

    const result = await pollForToken('device-code', 1, 900);
    expect(result.accessToken).toBe('test-token');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on expired_token', async () => {
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('expired_token', 'Expired'));

    await expect(pollForToken('device-code', 1, 900)).rejects.toThrow(/Device code expired/);
  });

  it('throws on access_denied', async () => {
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('access_denied', 'Denied'));

    await expect(pollForToken('device-code', 1, 900)).rejects.toThrow(/Authorization denied/);
  });

  it('throws BackendValidationError on unknown error code', async () => {
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('server_error', 'Boom'));

    const error = await pollForToken('device-code', 1, 900).catch((e) => e);
    expect(error).toBeInstanceOf(BackendValidationError);
    expect(error.errorCode).toBe('server_error');
  });

  it('throws NetworkError when fetch throws', async () => {
    mockApiFetch.mockRejectedValueOnce(new NetworkError());

    const error = await pollForToken('device-code', 1, 900).catch((e) => e);
    expect(error).toBeInstanceOf(NetworkError);
  });

  it('throws when deadline expires', async () => {
    // First poll returns authorization_pending, then time jumps past deadline
    mockApiFetch.mockRejectedValueOnce(new BackendValidationError('authorization_pending', 'Waiting'));
    const realDateNow = Date.now;
    let calls = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      calls++;
      // First call: set deadline. Second call: still within deadline. Third call: past deadline.
      if (calls <= 2) return realDateNow();
      return realDateNow() + 999_999_000;
    });

    await expect(pollForToken('device-code', 1, 900)).rejects.toThrow(/Device code expired/);

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------
describe('revokeToken', () => {
  it('sends DELETE with token', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(null, 204));

    await revokeToken('my-token');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/oauth/token', { method: 'DELETE' }, 'my-token');
  });

  it('succeeds on 204', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(null, 204));
    await expect(revokeToken('token')).resolves.toBeUndefined();
  });

  it('propagates errors to the caller', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(revokeToken('token')).rejects.toThrow('network');
  });
});
