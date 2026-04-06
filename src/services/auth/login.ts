import open from 'open';
import type { TokenStore } from '../../auth/session.js';
import * as api from '../../lib/api/index.js';
import { printDeviceCode } from '../../ui/banners.js';
import { createProgress } from '../../ui/progress.js';

interface LoginOptions {
  isInteractive: boolean;
  agentMode: boolean;
}

export async function performLogin(session: TokenStore, options: LoginOptions): Promise<string> {
  const progress = createProgress(options);

  try {
    const raw = await api.requestDeviceCode();

    let browserOpened = false;

    if (options.isInteractive && !options.agentMode) {
      try {
        await open(raw.verificationUrl);
        browserOpened = true;
      } catch {
        // fall back to manual URL display
      }
    }

    printDeviceCode(raw.userCode, raw.verificationUrl, browserOpened, options);
    progress.start('Waiting for authentication...');

    const tokenResponse = await api.pollForToken(raw.deviceCode, raw.interval, raw.expiresIn);
    await session.setToken(tokenResponse.accessToken);

    progress.succeed('Logged in successfully');

    return tokenResponse.accessToken;
  } catch (error) {
    progress.stop();
    throw error;
  }
}
