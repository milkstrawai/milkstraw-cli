import { AwsCredentialsError } from '../../../core/errors.js';
import * as aws from '../../../lib/aws/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

export async function validateAwsStep(input: SetupInput, state: SetupState): Promise<void> {
  const organization = requireState(state.organization, 'organization');
  const awsCredentials = await aws.validateCredentials(input.awsProfile);

  if (awsCredentials.accountId !== organization.managementAccount.accountId) {
    throw new AwsCredentialsError(
      `AWS account ID mismatch!\n` +
        `    Expected management account: ${organization.managementAccount.accountId}\n` +
        `    Got:                         ${awsCredentials.accountId}\n\n` +
        `  Your AWS credentials point to a different account than the one registered for this organization.\n` +
        `  Use --aws-profile to select the correct AWS profile.`,
    );
  }

  state.awsIdentity = { accountId: awsCredentials.accountId, arn: awsCredentials.arn };
}
