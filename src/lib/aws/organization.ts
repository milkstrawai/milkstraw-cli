import { ActivateOrganizationsAccessCommand } from '@aws-sdk/client-cloudformation';
import { DescribeOrganizationCommand } from '@aws-sdk/client-organizations';
import { AwsCredentialsError } from '../../core/errors.js';
import { hasName } from '../type-guards.js';
import {
  AwsPermissionsError,
  CredentialsError,
  createCfnClient,
  createOrganizationsClient,
  throwIfInvalidToken,
} from './client.js';
import { CREDENTIAL_ERROR_NAMES, formatCredentialsHint } from './credentials.js';

export async function discoverManagementAccountId(profile?: string): Promise<string> {
  const organizations = createOrganizationsClient(profile);

  try {
    const response = await organizations.send(new DescribeOrganizationCommand({}));
    const managementAccountId = response.Organization?.MasterAccountId;

    if (!managementAccountId || !/^\d{12}$/.test(managementAccountId)) {
      throw new AwsCredentialsError(
        `Unable to determine the AWS management account ID.\n\n` +
          `  AWS returned an invalid organization response.\n` +
          `  Verify that your credentials belong to an AWS Organization management account,\n` +
          `  then re-run: milkstraw setup`,
      );
    }

    return managementAccountId;
  } catch (error: unknown) {
    if (hasName(error) && CREDENTIAL_ERROR_NAMES.has(error.name)) {
      throw new CredentialsError(formatCredentialsHint(profile));
    }

    if (hasName(error) && error.name === 'AccessDeniedException') {
      throw new AwsPermissionsError(
        `Unable to determine the AWS management account ID.\n\n` +
          `  Missing required AWS permission:\n` +
          `    - organizations:DescribeOrganization\n\n` +
          `  Use credentials for the AWS Organization management account with that permission,\n` +
          `  then re-run: milkstraw setup`,
      );
    }

    if (hasName(error) && error.name === 'AWSOrganizationsNotInUseException') {
      throw new AwsCredentialsError(
        `Unable to determine the AWS management account ID.\n\n` +
          `  This AWS account is not part of an AWS Organization.\n` +
          `  Enable AWS Organizations or use credentials for an existing management account,\n` +
          `  then re-run: milkstraw setup`,
      );
    }

    throwIfInvalidToken(error, profile);
    throw new CredentialsError(error instanceof Error ? error.message : String(error));
  }
}

export async function enableStackSetsTrustedAccess(profile?: string): Promise<void> {
  const cloudformation = createCfnClient(profile);
  await cloudformation.send(new ActivateOrganizationsAccessCommand({}));
}
