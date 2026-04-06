import type { CliContext } from '../../core/context.js';
import { ConfigError } from '../../core/errors.js';
import type * as api from '../../lib/api/index.js';
import type { OnboardingStatus } from '../../lib/api/organizations.js';

export interface SetupInput {
  context: CliContext;
  organizationFlag?: string;
  awsProfile?: string;
  onStepStart?: (step: string) => void;
  onStepSuccess?: (step: string) => void;
  onInfo?: (message: string) => void;
  onWarning?: (message: string) => void;
  onProgress?: (message: string) => void;
}

export interface SetupState {
  token?: string;
  organization?: api.OrganizationListing;
  templates?: api.CloudFormationTemplates;
  awsIdentity?: {
    accountId: string;
    arn: string;
  };
  organizationDetails?: api.Organization;
  managementStackResult?: { skipped: boolean; status: string };
  managementAccountVerification?: api.Organization;
  stackSetResult?: { skipped: boolean; status: string };
  subaccountVerification?: api.Organization;
}

export function requireState<T>(value: T | undefined, field: string): T {
  if (value === undefined) {
    throw new ConfigError(`Setup state "${field}" is required but was not set by a previous step.`);
  }

  return value;
}

export function shouldPromptForOrganization(input: SetupInput): boolean {
  return input.context.isInteractive && !input.organizationFlag && !input.context.config.environmentOrganizationId;
}

export interface SetupResult {
  organizationId: string;
  organizationName: string;
  dashboardUrl: string;
  onboardingStatus: OnboardingStatus | 'unknown';
  breadcrumbs: Array<{ action: string; command: string }>;
  notices?: string[];
  warnings?: string[];
}
