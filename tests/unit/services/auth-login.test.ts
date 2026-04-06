import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/api/index.js', () => ({
  requestDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

vi.mock('../../../src/ui/banners.js', () => ({
  printDeviceCode: vi.fn(),
}));

vi.mock('../../../src/ui/progress.js', () => ({
  createProgress: vi.fn(() => ({
    start: vi.fn(),
    succeed: vi.fn(),
    stop: vi.fn(),
  })),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import * as api from '../../../src/lib/api/index.js';
import { performLogin } from '../../../src/services/auth/login.js';
import { printDeviceCode } from '../../../src/ui/banners.js';

function mockSession(): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(null),
    setToken: vi.fn().mockResolvedValue(undefined),
    clearToken: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockResolvedValue(false),
  };
}

const deviceCodeResponse = {
  userCode: 'XYZ-789',
  verificationUrl: 'https://auth.milkstraw.ai/activate',
  expiresIn: 900,
  interval: 5,
  deviceCode: 'dc_xyz',
};

describe('services/auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('performs full login flow and returns token', async () => {
    vi.mocked(api.requestDeviceCode).mockResolvedValue(deviceCodeResponse);
    vi.mocked(api.pollForToken).mockResolvedValue({ accessToken: 'tok_456' } as any);

    const session = mockSession();
    const token = await performLogin(session, { isInteractive: true, agentMode: false });

    expect(token).toBe('tok_456');
    expect(api.requestDeviceCode).toHaveBeenCalled();
    expect(api.pollForToken).toHaveBeenCalledWith('dc_xyz', 5, 900);
    expect(session.setToken).toHaveBeenCalledWith('tok_456');
  });

  it('displays device code to user', async () => {
    vi.mocked(api.requestDeviceCode).mockResolvedValue(deviceCodeResponse);
    vi.mocked(api.pollForToken).mockResolvedValue({ accessToken: 'tok' } as any);

    await performLogin(mockSession(), { isInteractive: true, agentMode: false });

    expect(printDeviceCode).toHaveBeenCalledWith(
      'XYZ-789',
      'https://auth.milkstraw.ai/activate',
      expect.any(Boolean),
      expect.objectContaining({ isInteractive: true }),
    );
  });

  it('propagates errors and stops progress', async () => {
    vi.mocked(api.requestDeviceCode).mockRejectedValue(new Error('network'));

    await expect(performLogin(mockSession(), { isInteractive: true, agentMode: false })).rejects.toThrow('network');
  });
});
