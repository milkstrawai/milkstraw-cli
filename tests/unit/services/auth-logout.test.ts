import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/api/index.js', () => ({
  revokeToken: vi.fn(),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import * as api from '../../../src/lib/api/index.js';
import { performLogout } from '../../../src/services/auth/logout.js';

function mockSession(token: string | null = 'tok_123'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn().mockResolvedValue(undefined),
    clearToken: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockResolvedValue(!!token),
  };
}

describe('services/auth/logout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('revokes token and clears session', async () => {
    const session = mockSession('tok_abc');
    vi.mocked(api.revokeToken).mockResolvedValue(undefined);

    const result = await performLogout(session);
    expect(result.revoked).toBe(true);
    expect(result.localCleared).toBe(true);
    expect(session.clearToken).toHaveBeenCalled();
  });

  it('clears session even if revocation fails', async () => {
    const session = mockSession('tok_abc');
    vi.mocked(api.revokeToken).mockRejectedValue(new Error('network'));

    const result = await performLogout(session);
    expect(result.revoked).toBe(false);
    expect(result.localCleared).toBe(true);
  });

  it('returns false when not logged in', async () => {
    const session = mockSession(null);

    const result = await performLogout(session);
    expect(result.revoked).toBe(false);
    expect(result.localCleared).toBe(false);
  });
});
