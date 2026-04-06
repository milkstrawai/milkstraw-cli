import type { TokenStore } from '../../auth/session.js';
import * as api from '../../lib/api/index.js';

interface LogoutResult {
  revoked: boolean;
  localCleared: boolean;
}

export async function performLogout(session: TokenStore): Promise<LogoutResult> {
  const token = await session.getToken();

  if (!token) {
    return { revoked: false, localCleared: false };
  }

  let revoked = false;

  try {
    await api.revokeToken(token);
    revoked = true;
  } catch {
    // Best-effort
  }

  await session.clearToken();

  return { revoked, localCleared: true };
}
