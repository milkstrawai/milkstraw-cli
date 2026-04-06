import {
  AuthRequiredError,
  BackendValidationError,
  NetworkError,
  PermissionError,
  RateLimitError,
  ServerError,
} from '../core/errors.js';
import { withRetry } from './retry.js';
import type { ApiTransport, TransportRequestOptions, TransportResponse } from './types.js';

export interface TransportConfig {
  baseUrl: string;
  userAgent: string;
  timeout: number;
  verbose: boolean;
}

export function createTransport(config: TransportConfig): ApiTransport {
  async function doFetch(
    path: string,
    token: string | null,
    options: TransportRequestOptions = {},
  ): Promise<TransportResponse> {
    const url = new URL(path, config.baseUrl).toString();
    const method = options.method ?? 'GET';
    const timeout = options.timeout ?? config.timeout;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': config.userAgent,
      ...(options.headers ?? {}),
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (config.verbose) {
      const redactedHeaders = { ...headers };

      if (redactedHeaders.Authorization) {
        redactedHeaders.Authorization = 'Bearer [REDACTED]';
      }

      process.stderr.write(`[transport] ${method} ${url}\n`);
      process.stderr.write(`[transport] headers ${JSON.stringify(redactedHeaders)}\n`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error: unknown) {
      if (error instanceof TypeError || error instanceof DOMException) {
        throw new NetworkError();
      }

      throw error;
    }

    if (config.verbose) {
      process.stderr.write(`[transport] ${response.status} ${response.statusText}\n`);
    }

    if (response.ok) return wrapResponse(response);

    // Map error responses
    const body = await response.json().catch(() => ({ error: 'unknown', message: response.statusText }));

    if (response.status === 401) {
      throw new AuthRequiredError(body.message ?? 'Authentication required.');
    }

    if (response.status === 403) {
      throw new PermissionError(body.message ?? 'Permission denied.');
    }

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10) || undefined;
      throw new RateLimitError(body.message ?? 'Rate limited.', retryAfter);
    }

    if (response.status >= 500) {
      throw new ServerError(response.status, body.message ?? response.statusText);
    }

    throw new BackendValidationError(body.error ?? 'unknown', body.message ?? response.statusText);
  }

  return {
    fetch(path: string, token?: string, options?: TransportRequestOptions): Promise<TransportResponse> {
      const idempotent = options?.idempotent ?? (options?.method ?? 'GET') === 'GET';

      if (idempotent) {
        return withRetry(() => doFetch(path, token ?? null, options));
      }

      return doFetch(path, token ?? null, options);
    },
  };
}

function wrapResponse(response: Response): TransportResponse {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    ok: response.ok,
    status: response.status,
    headers,
    json<T>() {
      return response.json() as Promise<T>;
    },
    text() {
      return response.text();
    },
  };
}
