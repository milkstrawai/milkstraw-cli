import * as api from '../../../lib/api/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

export async function prepareDeploymentStep(_input: SetupInput, state: SetupState): Promise<void> {
  const token = requireState(state.token, 'token');
  const organization = requireState(state.organization, 'organization');

  const [templateData, organizationDetails] = await Promise.all([
    api.getCloudFormationTemplates(),
    api.getOrganization(token, organization.id),
  ]);

  state.templates = templateData;
  state.organizationDetails = organizationDetails;
}
