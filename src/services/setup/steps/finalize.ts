import { requireState, type SetupInput, type SetupResult, type SetupState } from '../types.js';

export function finalizeStep(input: SetupInput, state: SetupState): SetupResult {
  const organization = requireState(state.organization, 'organization');
  const verification = state.subaccountVerification ?? state.managementAccountVerification;
  const onboardingStatus = verification?.onboarding ?? 'unknown';
  const dashboardUrl = `${input.context.config.apiUrl}/organizations/${organization.id}/overview`;

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    dashboardUrl,
    onboardingStatus,
    breadcrumbs:
      onboardingStatus !== 'complete'
        ? [
            { action: 'Check progress', command: 'milkstraw status' },
            { action: 'View dashboard', command: dashboardUrl },
          ]
        : [{ action: 'View dashboard', command: dashboardUrl }],
  };
}
