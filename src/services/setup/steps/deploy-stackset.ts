import * as aws from '../../../lib/aws/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

export async function deployStackSetStep(input: SetupInput, state: SetupState): Promise<void> {
  const templates = requireState(state.templates, 'templates');
  const verified = requireState(state.managementAccountVerification, 'managementAccountVerification');

  if (verified.onboarding === 'complete') {
    input.onInfo?.('StackSet deployment not required');
    input.onInfo?.('Single-account organization detected.');
    return;
  }

  if (!verified.rootId) {
    throw new aws.AwsPermissionsError('Organization root ID is missing after verification.');
  }

  input.onStepStart?.('Deploying StackSet wrapper stack');
  input.onProgress?.('Deploying StackSet wrapper stack...');

  const deployParams = {
    stackName: templates.templates.stackset.name,
    templateUrl: templates.templates.stackset.url,
    parameters: aws.buildStackSetWrapperParams({
      externalId: verified.externalId,
      roleName: verified.roleName,
      milkstrawPrincipal: templates.milkstrawAccountId,
      organizationId: verified.rootId,
    }),
    profile: input.awsProfile,
  };

  let result: Awaited<ReturnType<typeof aws.deployStack>>;
  try {
    result = await aws.deployStack(deployParams);
  } catch (error) {
    if (!(error instanceof aws.StackSetsTrustedAccessError)) throw error;

    input.onInfo?.('StackSets trusted access is not enabled. Enabling it...');

    try {
      await aws.enableStackSetsTrustedAccess(input.awsProfile);
    } catch {
      // Enable failed (likely missing permissions). Throw the original error with manual remediation.
      throw error;
    }

    input.onInfo?.('Trusted access enabled. Retrying StackSet deployment...');
    input.onProgress?.('Deploying StackSet wrapper stack...');

    result = await aws.deployStack(deployParams);
  }

  state.stackSetResult = { skipped: result.skipped, status: result.status };
  input.onStepSuccess?.(result.skipped ? 'StackSet wrapper stack already ready' : 'StackSet wrapper stack deployed');
}
