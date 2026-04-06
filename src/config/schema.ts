export type RenderFormat = 'auto' | 'json' | 'markdown';

export interface CliConfig {
  apiUrl: string;
  awsProfile?: string;
  environmentOrganizationId?: string;
  renderFormat: RenderFormat;
  isQuiet: boolean;
  verbose: boolean;
  agentMode: boolean;
}
