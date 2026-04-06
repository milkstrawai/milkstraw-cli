import type { TokenStore } from '../auth/session.js';
import type { CliConfig } from '../config/schema.js';
import type { ApiTransport } from '../transport/types.js';

export type ResolvedRenderFormat = Exclude<CliConfig['renderFormat'], 'auto'> | 'text';

export interface ResolvedCliConfig extends Omit<CliConfig, 'renderFormat'> {
  renderFormat: ResolvedRenderFormat;
}

export interface CliContext {
  config: ResolvedCliConfig;
  auth: TokenStore;
  transport: ApiTransport;
  isInteractive: boolean;
  isTTY: boolean;
}
