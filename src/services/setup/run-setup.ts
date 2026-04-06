import { authenticateStep } from './steps/authenticate.js';
import { deployManagementStackStep } from './steps/deploy-management-stack.js';
import { deployStackSetStep } from './steps/deploy-stackset.js';
import { finalizeStep } from './steps/finalize.js';
import { prepareDeploymentStep } from './steps/prepare-deployment.js';
import { resolveOrganizationStep } from './steps/resolve-organization.js';
import { validateAwsStep } from './steps/validate-aws.js';
import { verifyManagementAccountStep } from './steps/verify-management-account.js';
import { verifySubaccountsStep } from './steps/verify-subaccounts.js';
import { type SetupInput, type SetupResult, type SetupState, shouldPromptForOrganization } from './types.js';

export async function runSetup(input: SetupInput): Promise<SetupResult> {
  const state: SetupState = {};
  state.token = (await input.context.auth.getToken()) ?? undefined;
  const hadExistingToken = Boolean(state.token);

  if (hadExistingToken) {
    input.onStepStart?.('Authenticating');
  }
  await authenticateStep(input, state);
  if (hadExistingToken) {
    input.onStepSuccess?.('Authenticated');
  }

  const isAutoResolvingOrganization = !shouldPromptForOrganization(input);
  if (isAutoResolvingOrganization) {
    input.onStepStart?.('Resolving organization');
  }
  await resolveOrganizationStep(input, state);
  if (isAutoResolvingOrganization) {
    input.onStepSuccess?.(state.organization ? `Organization: ${state.organization.name}` : 'Organization resolved');
  }

  input.onStepStart?.('Validating AWS credentials');
  await validateAwsStep(input, state);
  input.onStepSuccess?.('AWS credentials validated');

  input.onStepStart?.('Preparing deployment');
  await prepareDeploymentStep(input, state);
  input.onStepSuccess?.('Deployment plan ready');

  await deployManagementStackStep(input, state);

  try {
    await verifyManagementAccountStep(input, state);
    await deployStackSetStep(input, state);
    await verifySubaccountsStep(input, state);
  } catch (error) {
    input.onWarning?.(
      'Management stack was deployed successfully.\n' +
        '  Re-run `milkstraw setup` to continue after fixing the issue below.\n',
    );
    throw error;
  }

  return finalizeStep(input, state);
}
