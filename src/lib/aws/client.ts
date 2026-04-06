import { CloudFormationClient, type Parameter } from '@aws-sdk/client-cloudformation';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { STSClient } from '@aws-sdk/client-sts';
import { AwsCredentialsError, AwsDeploymentError } from '../../core/errors.js';
import { hasMessage, hasName } from '../type-guards.js';

const AWS_REGION = 'us-east-1';
const INVALID_TOKEN_NAMES = new Set(['InvalidIdentityToken', 'InvalidClientTokenId']);

export class CredentialsError extends AwsCredentialsError {
  constructor(message = 'No AWS credentials found.') {
    super(message);
    this.name = 'CredentialsError';
  }
}

export class AwsPermissionsError extends AwsDeploymentError {
  constructor(message: string) {
    super(message);
    this.name = 'AwsPermissionsError';
  }
}

export class StackError extends AwsDeploymentError {
  constructor(message: string) {
    super(message);
    this.name = 'StackError';
  }
}

export class StackSetError extends AwsDeploymentError {
  constructor(message: string) {
    super(message);
    this.name = 'StackSetError';
  }
}

export class StackSetsTrustedAccessError extends StackError {
  constructor() {
    super(
      `StackSet deployment requires AWS Organizations trusted access for CloudFormation.\n\n` +
        `  To enable it, run:\n` +
        `    $ aws cloudformation activate-organizations-access\n\n` +
        `  Or enable it in the AWS CloudFormation console on the StackSets page.\n\n` +
        `  Then re-run: milkstraw setup`,
    );
    this.name = 'StackSetsTrustedAccessError';
  }
}

export function createCfnClient(profile?: string): CloudFormationClient {
  return new CloudFormationClient({ region: AWS_REGION, ...(profile ? { profile } : {}) });
}

export function createStsClient(profile?: string): STSClient {
  return new STSClient({ region: AWS_REGION, ...(profile ? { profile } : {}) });
}

export function createOrganizationsClient(profile?: string): OrganizationsClient {
  return new OrganizationsClient({ region: AWS_REGION, ...(profile ? { profile } : {}) });
}

export function buildManagementStackParams(params: {
  externalId: string;
  roleName: string;
  milkstrawPrincipal: string;
}): Parameter[] {
  return [
    { ParameterKey: 'ExternalID', ParameterValue: params.externalId },
    { ParameterKey: 'RoleName', ParameterValue: params.roleName },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: params.milkstrawPrincipal },
  ];
}

export function buildStackSetWrapperParams(params: {
  externalId: string;
  roleName: string;
  milkstrawPrincipal: string;
  organizationId: string;
}): Parameter[] {
  return [
    { ParameterKey: 'ExternalID', ParameterValue: params.externalId },
    { ParameterKey: 'RoleName', ParameterValue: params.roleName },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: params.milkstrawPrincipal },
    { ParameterKey: 'OrganizationID', ParameterValue: params.organizationId },
  ];
}

export function extractMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isInvalidTokenError(error: unknown): boolean {
  if (hasName(error) && INVALID_TOKEN_NAMES.has(error.name)) return true;
  if (hasMessage(error) && error.message.includes('security token included in the request is invalid')) return true;
  return false;
}

export function throwIfInvalidToken(error: unknown, profile?: string): void {
  if (!isInvalidTokenError(error)) return;

  const profileLabel = profile ? `"${profile}"` : '"default"';
  throw new CredentialsError(
    `AWS credentials are invalid or expired.\n\n` +
      `  This usually means:\n` +
      `    • Your SSO session has expired — run: aws sso login${profile ? ` --profile ${profile}` : ''}\n` +
      `    • Your temporary credentials have expired — refresh them\n` +
      `    • The wrong AWS profile is selected — current: ${profileLabel}\n` +
      `\n  To use a different profile: milkstraw --aws-profile <name> <command>`,
  );
}
