/**
 * Reusable multi-organization test fixtures for CLI tests.
 * These cover the scenarios required by the v2 plan:
 * - user with 1 org
 * - user with 3 orgs
 * - mixed org accessibility scenarios
 * - no manageable orgs
 * - local org conflicting with profile default
 * - inaccessible org chosen by explicit input
 */

export interface MockOrg {
  id: string;
  name: string;
  onboarding: string;
  managementAccount: {
    id: string;
    accountId: string;
    nickname: string;
    access: string;
  };
}

// Scenario: user with 1 org
export const singleOrganization: MockOrg[] = [
  {
    id: 'org_single',
    name: 'Solo Corp',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: 'main', access: 'granted' },
  },
];

// Scenario: user with 3 orgs
export const threeOrganizations: MockOrg[] = [
  {
    id: 'org_prod',
    name: 'Acme Production',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: 'prod', access: 'granted' },
  },
  {
    id: 'org_staging',
    name: 'Acme Staging',
    onboarding: 'complete',
    managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: 'staging', access: 'granted' },
  },
  {
    id: 'org_dev',
    name: 'Acme Dev',
    onboarding: 'pending',
    managementAccount: { id: 'acc_3', accountId: '333333333333', nickname: 'dev', access: 'granted' },
  },
];

// Scenario: multiple accessible orgs with different operational states
export const mixedPermissionOrgs: MockOrg[] = [
  {
    id: 'org_managed',
    name: 'Managed Org',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  },
  {
    id: 'org_viewonly',
    name: 'View Only Org',
    onboarding: 'complete',
    managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
  },
];

// Scenario: no manageable orgs (empty list)
export const noOrganizations: MockOrg[] = [];

// Scenario: local org conflicting with profile default
export const conflictingOrgConfig = {
  localConfigOrganizationId: 'org_local',
  profileDefaultOrganizationId: 'org_profile',
  organizations: [
    {
      id: 'org_local',
      name: 'Local Project Org',
      onboarding: 'complete',
      managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
    },
    {
      id: 'org_profile',
      name: 'Profile Default Org',
      onboarding: 'complete',
      managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
    },
  ] as MockOrg[],
};

// Scenario: inaccessible org chosen by explicit input
export const inaccessibleOrgScenario = {
  flagOrganizationId: 'org_nonexistent',
  accessibleOrganizations: threeOrganizations,
};
