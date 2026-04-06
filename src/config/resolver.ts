import { readEnvConfig } from './env.js';
import type { CliConfig, RenderFormat } from './schema.js';

const DEFAULT_API_URL = 'https://app.milkstraw.ai';

export interface CliFlags {
  org?: string;
  awsProfile?: string;
  json?: boolean;
  quiet?: boolean;
  markdown?: boolean;
  verbose?: boolean;
  agent?: boolean;
}

export function resolveConfig(flags: CliFlags = {}): CliConfig {
  const env = readEnvConfig();
  const { renderFormat, isQuiet } = resolveOutputModes(flags);

  return {
    apiUrl: env.apiUrl ?? DEFAULT_API_URL,
    awsProfile: flags.awsProfile ?? env.awsProfile,
    environmentOrganizationId: env.organizationId,
    renderFormat,
    isQuiet,
    verbose: flags.verbose ?? false,
    agentMode: flags.agent ?? false,
  };
}

function resolveOutputModes(flags: CliFlags): {
  renderFormat: RenderFormat;
  isQuiet: boolean;
} {
  const isQuiet = flags.quiet ?? false;
  return {
    renderFormat: resolveRenderFormat(flags),
    isQuiet,
  };
}

function resolveRenderFormat(flags: CliFlags): RenderFormat {
  if (flags.quiet) return 'json';
  if (flags.markdown) return 'markdown';
  if (flags.json) return 'json';

  return 'auto';
}
