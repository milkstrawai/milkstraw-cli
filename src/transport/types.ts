export interface ApiTransport {
  fetch(path: string, token?: string, options?: TransportRequestOptions): Promise<TransportResponse>;
}

export interface TransportRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  idempotent?: boolean;
}

export interface TransportResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}
