import type { OnboardingStatus } from '../../lib/api/index.js';
import * as api from '../../lib/api/index.js';

export interface OrganizationListItem {
  id: string;
  name: string;
  onboarding: OnboardingStatus;
  managementAccountId: string;
}

export async function listOrganizations(token: string): Promise<OrganizationListItem[]> {
  const organizations = await api.listOrganizations(token);

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    onboarding: organization.onboarding,
    managementAccountId: organization.managementAccount.accountId,
  }));
}
