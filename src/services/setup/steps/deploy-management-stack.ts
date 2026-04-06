import * as aws from '../../../lib/aws/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

export async function deployManagementStackStep(input: SetupInput, state: SetupState): Promise<void> {
  input.onStepStart?.('Deploying management stack');
  input.onProgress?.('Deploying management stack...');

  const templates = requireState(state.templates, 'templates');
  const organizationDetails = requireState(state.organizationDetails, 'organizationDetails');

  const result = await aws.deployStack({
    stackName: templates.templates.management.name,
    templateUrl: templates.templates.management.url,
    parameters: aws.buildManagementStackParams({
      externalId: organizationDetails.externalId,
      roleName: organizationDetails.roleName,
      milkstrawPrincipal: templates.milkstrawAccountId,
    }),
    profile: input.awsProfile,
  });

  state.managementStackResult = { skipped: result.skipped, status: result.status };
  input.onStepSuccess?.(result.skipped ? 'Management stack already ready' : 'Management stack ready');
}
