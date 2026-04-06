import { NetworkError, ServerError } from '../../core/errors.js';
import type { ApiTransport, TransportResponse } from '../../transport/types.js';

// Module-level transport singleton — initialized by core/cli.ts at startup
let transport: ApiTransport | null = null;

export function initializeApiTransport(t: ApiTransport): void {
  transport = t;
}

function getTransport(): ApiTransport {
  if (!transport) {
    throw new Error('API transport not initialized. Call initializeApiTransport() first.');
  }

  return transport;
}

export function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {},
  token?: string,
): Promise<TransportResponse> {
  const t = getTransport();
  const transportOptions = {
    method: options.method,
    body: options.body,
  };

  return t.fetch(path, token, transportOptions);
}

export async function checkConnectivity(): Promise<void> {
  const t = getTransport();

  try {
    await t.fetch('/api/cloudformation/templates', undefined, { timeout: 5000 });
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    if (error instanceof ServerError) throw new NetworkError('MilkStraw API is experiencing issues. Try again later.');

    throw new NetworkError();
  }
}
