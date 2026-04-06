import { describe, expect, it } from 'vitest';
import type { Organization } from '../../../src/lib/api/index.js';
import { summarizeSubAccounts } from '../../../src/lib/organizations.js';

const organization: Organization = {
  id: 'org-1',
  name: 'Test Org',
  onboarding: 'complete',
  externalId: 'ext-1',
  roleName: 'MilkStrawRoleV2',
  managementAccount: {
    id: 'mgmt',
    accountId: '111111111111',
    nickname: 'Management',
    access: 'granted',
  },
  accounts: [
    {
      id: 'mgmt',
      accountId: '111111111111',
      nickname: 'Management',
      access: 'granted',
    },
    {
      id: 'sub-1',
      accountId: '222222222222',
      nickname: 'Prod',
      access: 'granted',
    },
    {
      id: 'sub-2',
      accountId: '333333333333',
      nickname: 'Stage',
      access: 'denied',
    },
    {
      id: 'sub-3',
      accountId: '444444444444',
      nickname: 'Ops',
      access: 'suspended',
    },
  ],
  stacks: {
    managementStack: { name: 'MilkStrawAccessStackV2', version: '2.0' },
    stackset: { name: 'MilkStrawStackSetWrapper', version: '1.0' },
  },
};

describe('organization helpers', () => {
  it('summarizes sub-accounts by explicit access status', () => {
    expect(summarizeSubAccounts(organization)).toEqual({
      total: 3,
      granted: 1,
      byStatus: {
        granted: [
          {
            id: 'sub-1',
            accountId: '222222222222',
            nickname: 'Prod',
            access: 'granted',
          },
        ],
        denied: [
          {
            id: 'sub-2',
            accountId: '333333333333',
            nickname: 'Stage',
            access: 'denied',
          },
        ],
        suspended: [
          {
            id: 'sub-3',
            accountId: '444444444444',
            nickname: 'Ops',
            access: 'suspended',
          },
        ],
        closed: [],
      },
    });
  });

  it('treats organizations without sub-accounts as single-account orgs', () => {
    const singleAccountOrg: Organization = {
      ...organization,
      accounts: [organization.accounts[0]],
    };

    expect(summarizeSubAccounts(singleAccountOrg)).toEqual({
      total: 0,
      granted: 0,
      byStatus: {
        granted: [],
        denied: [],
        suspended: [],
        closed: [],
      },
    });
  });
});
