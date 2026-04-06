import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/api/index.js', () => ({
  checkConnectivity: vi.fn().mockResolvedValue(undefined),
  getOrganization: vi.fn(),
  getCloudFormationTemplates: vi.fn(),
}));

vi.mock('../../../src/lib/aws/index.js', () => ({
  getStackStatus: vi.fn(),
}));

vi.mock('../../../src/lib/organizations.js', () => ({
  summarizeSubAccounts: vi.fn(),
}));

import type { OrganizationContext } from '../../../src/context/organization.js';
import * as api from '../../../src/lib/api/index.js';
import * as aws from '../../../src/lib/aws/index.js';
import { summarizeSubAccounts } from '../../../src/lib/organizations.js';
import { getStatus } from '../../../src/services/status/index.js';

const organizationContext: OrganizationContext = {
  organizationId: 'org_1',
  organizationName: 'Test Org',
  source: 'flag',
};

describe('services/status/getStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(api.getOrganization).mockResolvedValue({
      id: 'org_1',
      name: 'Test Org',
      onboarding: 'complete',
      managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
      stacks: {
        managementStack: { name: 'ms-stack', version: '1.0' },
        stackset: { name: 'ms-stackset', version: '1.0' },
      },
    } as any);

    vi.mocked(api.getCloudFormationTemplates).mockResolvedValue({
      templates: {
        management: { name: 'ms-stack', version: '1.1', url: 'https://tpl/mgmt' },
        stackset: { name: 'ms-stackset', version: '1.1', url: 'https://tpl/ss' },
      },
      milkstrawAccountId: '999999999999',
    } as any);

    vi.mocked(aws.getStackStatus).mockResolvedValue({ exists: true, status: 'CREATE_COMPLETE' } as any);
    vi.mocked(summarizeSubAccounts).mockReturnValue({
      total: 5,
      granted: 5,
      byStatus: { granted: [{ accountId: '222222222222' }], denied: [], suspended: [], closed: [] },
    } as any);
  });

  it('returns structured status data', async () => {
    const status = await getStatus('tok', organizationContext, 'my-profile');

    expect(status.organization.id).toBe('org_1');
    expect(status.organization.name).toBe('Test Org');
    expect(status.managementAccount).toEqual({
      accountId: '111111111111',
      access: 'granted',
    });
    expect(status.managementStack.status).toBe('CREATE_COMPLETE');
    expect(status.managementStack.healthy).toBe(true);
    expect(status.stackSet.status).toBe('CREATE_COMPLETE');
    expect(status.stackSet.healthy).toBe(true);
    expect(status.subAccounts.total).toBe(5);
    expect(status.subAccounts.byStatus.denied).toEqual([]);
    expect(status.subAccounts.byStatus.granted).toEqual([{ accountId: '222222222222' }]);
  });

  it('handles not-deployed stacks', async () => {
    vi.mocked(aws.getStackStatus).mockResolvedValue({ exists: false, status: 'not_found' } as any);

    const status = await getStatus('tok', organizationContext);
    expect(status.managementStack.status).toBe('not_deployed');
    expect(status.managementStack.healthy).toBe(false);
  });

  it('marks rollback-complete stacks as healthy (stack rolled back to previous good state)', async () => {
    vi.mocked(aws.getStackStatus).mockResolvedValue({ exists: true, status: 'UPDATE_ROLLBACK_COMPLETE' } as any);

    const status = await getStatus('tok', organizationContext);

    expect(status.managementStack.status).toBe('UPDATE_ROLLBACK_COMPLETE');
    expect(status.managementStack.healthy).toBe(true);
  });

  it('shows version comparison', async () => {
    const status = await getStatus('tok', organizationContext);
    expect(status.managementStack.deployedVersion).toBe('1.0');
    expect(status.managementStack.latestVersion).toBe('1.1');
  });

  it('treats a missing stackset as not deployed', async () => {
    vi.mocked(aws.getStackStatus).mockResolvedValueOnce({ exists: true, status: 'CREATE_COMPLETE' } as any);
    vi.mocked(aws.getStackStatus).mockResolvedValueOnce({ exists: false, status: 'not_found' } as any);

    const status = await getStatus('tok', organizationContext);

    expect(status.stackSet).toEqual({
      name: 'ms-stackset',
      status: 'not_deployed',
      healthy: false,
      deployedVersion: null,
      latestVersion: '1.1',
    });
  });

  it('skips AWS stack lookups when the organization has no deployed stacks', async () => {
    vi.mocked(api.getOrganization).mockResolvedValue({
      id: 'org_1',
      name: 'Test Org',
      onboarding: 'pending',
      managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
      stacks: undefined,
    } as any);

    const status = await getStatus('tok', organizationContext, 'aws-profile');

    expect(aws.getStackStatus).not.toHaveBeenCalled();
    expect(status.managementStack.status).toBe('not_deployed');
    expect(status.stackSet.status).toBe('not_deployed');
  });

  it('propagates connectivity failures before loading organization data', async () => {
    vi.mocked(api.checkConnectivity).mockRejectedValue(new Error('offline'));

    await expect(getStatus('tok', organizationContext)).rejects.toThrow('offline');
    expect(api.getOrganization).not.toHaveBeenCalled();
  });
});
