import { resolveOrganizationFromContext } from '../../../context/organization.js';
import { PERMISSION_ACTIONS, rethrowOrganizationPermissionError } from '../../../context/permissions.js';
import * as api from '../../../lib/api/index.js';
import * as aws from '../../../lib/aws/index.js';
import { promptOrganizationDetails, resolveOrganizationForSetup } from '../prompts.js';
import { requireState, type SetupInput, type SetupState, shouldPromptForOrganization } from '../types.js';

export async function resolveOrganizationStep(input: SetupInput, state: SetupState): Promise<void> {
  const token = requireState(state.token, 'token');
  const isInteractiveOrgSelection = shouldPromptForOrganization(input);

  if (!isInteractiveOrgSelection) {
    const organizationContext = await resolveOrganizationFromContext(input.context, token, input.organizationFlag);

    try {
      state.organization = await api.getOrganization(token, organizationContext.organizationId);
      return;
    } catch (error) {
      rethrowOrganizationPermissionError(
        error,
        PERMISSION_ACTIONS.RUN_SETUP,
        organizationContext.organizationId,
        organizationContext.organizationName,
      );
    }
  }

  if (input.context.isInteractive) {
    const organization = await resolveOrganizationForSetup(token, input.organizationFlag);

    if (organization) {
      state.organization = organization;
    } else {
      const details = await promptOrganizationDetails();
      const managementAccountId = await aws.discoverManagementAccountId(input.awsProfile);
      const created = await api.createOrganization(token, details.name, managementAccountId);
      state.organization = created;
    }
  }
}
