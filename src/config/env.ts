export interface EnvConfig {
  apiUrl?: string;
  organizationId?: string;
  awsProfile?: string;
}

export function readEnvConfig(): EnvConfig {
  return {
    apiUrl: process.env.MILKSTRAW_API_URL || undefined,
    organizationId: process.env.MILKSTRAW_ORG || undefined,
    awsProfile: process.env.MILKSTRAW_AWS_PROFILE || undefined,
  };
}
