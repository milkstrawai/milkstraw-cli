import { setTimeout as sleep } from 'node:timers/promises';
import { AuthRequiredError, BackendValidationError } from '../../core/errors.js';
import { apiFetch } from './client.js';
import { getDeviceName } from './device.js';

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { email: string };
}

interface RawDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface RawTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: { email: string };
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await apiFetch('/api/oauth/device_codes', {
    method: 'POST',
    body: {},
  });

  const rawResponse = await response.json<RawDeviceCodeResponse>();

  return {
    deviceCode: rawResponse.device_code,
    userCode: rawResponse.user_code,
    verificationUrl: rawResponse.verification_url,
    expiresIn: rawResponse.expires_in,
    interval: rawResponse.interval,
  };
}

export async function pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<TokenResponse> {
  let currentInterval = interval;
  const deadline = Date.now() + expiresIn * 1000;

  while (true) {
    if (Date.now() > deadline) {
      throw new AuthRequiredError('Device code expired. Run `milkstraw login` to try again.');
    }

    await sleep(currentInterval * 1000);

    let response: Awaited<ReturnType<typeof apiFetch>>;

    try {
      response = await apiFetch('/api/oauth/token', {
        method: 'POST',
        body: {
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_name: getDeviceName(),
        },
      });
    } catch (error) {
      // Transport throws typed errors for non-OK responses
      if (error instanceof BackendValidationError) {
        switch (error.errorCode) {
          case 'authorization_pending':
            continue;
          case 'slow_down':
            currentInterval += 5;
            continue;
          case 'expired_token':
            throw new AuthRequiredError('Device code expired. Run `milkstraw login` to try again.');
          case 'access_denied':
            throw new AuthRequiredError('Authorization denied. Run `milkstraw login` to try again.');
          default:
            throw error;
        }
      }

      throw error;
    }

    const rawResponse = await response.json<RawTokenResponse>();

    return {
      accessToken: rawResponse.access_token,
      tokenType: rawResponse.token_type,
      expiresIn: rawResponse.expires_in,
      user: rawResponse.user,
    };
  }
}

export async function revokeToken(token: string): Promise<void> {
  await apiFetch('/api/oauth/token', { method: 'DELETE' }, token);
}
