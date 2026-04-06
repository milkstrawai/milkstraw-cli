import * as api from '../../../lib/api/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

export async function verifyManagementAccountStep(input: SetupInput, state: SetupState): Promise<void> {
  input.onStepStart?.('Verifying management account');
  const token = requireState(state.token, 'token');
  const organization = requireState(state.organization, 'organization');

  state.managementAccountVerification = await api.verifyManagementAccount(token, organization.id);
  input.onStepSuccess?.('Management account verified');
}
