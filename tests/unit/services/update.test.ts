import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/api/index.js', () => ({
  checkConnectivity: vi.fn().mockResolvedValue(undefined),
  getOrganization: vi.fn(),
  getCloudFormationTemplates: vi.fn(),
  reportStacksUpdated: vi.fn(),
}));

vi.mock('../../../src/lib/aws/index.js', () => ({
  validateCredentials: vi.fn().mockResolvedValue({ accountId: '123456789012', arn: 'arn:aws:iam::root' }),
  updateStack: vi.fn(),
  buildManagementStackParams: vi.fn().mockReturnValue([
    { ParameterKey: 'ExternalID', ParameterValue: 'ext_1' },
    { ParameterKey: 'RoleName', ParameterValue: 'MilkstrawRole' },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '999999999999' },
  ]),
  buildStackSetWrapperParams: vi.fn().mockReturnValue([
    { ParameterKey: 'ExternalID', ParameterValue: 'ext_1' },
    { ParameterKey: 'RoleName', ParameterValue: 'MilkstrawRole' },
    { ParameterKey: 'MilkStrawPrincipal', ParameterValue: '999999999999' },
    { ParameterKey: 'OrganizationID', ParameterValue: 'r-1234' },
  ]),
}));

import type { OrganizationContext } from '../../../src/context/organization.js';
import * as api from '../../../src/lib/api/index.js';
import * as aws from '../../../src/lib/aws/index.js';
import { applyUpdates, checkForUpdates } from '../../../src/services/update/index.js';

const organizationContext: OrganizationContext = {
  organizationId: 'org_1',
  organizationName: 'Test Org',
  source: 'flag',
};

const mockOrgDetails = {
  id: 'org_1',
  name: 'Test Org',
  externalId: 'ext_1',
  roleName: 'MilkstrawRole',
  rootId: 'r-1234',
  stacks: {
    managementStack: { name: 'ms-stack', version: '1.0' },
    stackset: { name: 'ms-stackset', version: '1.0' },
  },
} as any;

const mockTemplates = {
  templates: {
    management: { name: 'ms-stack', version: '1.1', url: 'https://tpl/mgmt' },
    stackset: { name: 'ms-stackset', version: '1.1', url: 'https://tpl/ss' },
  },
  milkstrawAccountId: '999999999999',
} as any;

describe('services/update', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getOrganization).mockResolvedValue(mockOrgDetails);
    vi.mocked(api.getCloudFormationTemplates).mockResolvedValue(mockTemplates);
    vi.mocked(api.reportStacksUpdated).mockResolvedValue(undefined);
  });

  describe('checkForUpdates', () => {
    it('detects when updates are needed', async () => {
      const result = await checkForUpdates('tok', organizationContext);
      expect(result.needsManagementUpdate).toBe(true);
      expect(result.needsStackSetUpdate).toBe(true);
      expect(result.updates).toHaveLength(2);
    });

    it('detects when everything is up to date', async () => {
      vi.mocked(api.getOrganization).mockResolvedValue({
        ...mockOrgDetails,
        stacks: {
          managementStack: { name: 'ms-stack', version: '1.1' },
          stackset: { name: 'ms-stackset', version: '1.1' },
        },
      });

      const result = await checkForUpdates('tok', organizationContext);
      expect(result.needsManagementUpdate).toBe(false);
      expect(result.needsStackSetUpdate).toBe(false);
    });

    it('throws when no stacks are deployed', async () => {
      vi.mocked(api.getOrganization).mockResolvedValue({
        ...mockOrgDetails,
        stacks: undefined,
      });

      await expect(checkForUpdates('tok', organizationContext)).rejects.toThrow('No stacks deployed');
    });
  });

  describe('applyUpdates', () => {
    it('applies management stack and stackset updates', async () => {
      vi.mocked(aws.updateStack).mockResolvedValue({ status: 'UPDATE_COMPLETE' } as any);

      const check = await checkForUpdates('tok', organizationContext);
      const result = await applyUpdates('tok', organizationContext, check, 'aws-profile');

      expect(result.updates).toHaveLength(2);
      expect(aws.updateStack).toHaveBeenCalledTimes(2);
      expect(aws.updateStack).toHaveBeenCalledWith(
        expect.objectContaining({
          stackName: 'ms-stack',
          templateUrl: 'https://tpl/mgmt',
          profile: 'aws-profile',
        }),
      );
      expect(aws.buildManagementStackParams).toHaveBeenCalledWith({
        externalId: 'ext_1',
        roleName: 'MilkstrawRole',
        milkstrawPrincipal: '999999999999',
      });
      expect(aws.updateStack).toHaveBeenCalledWith(
        expect.objectContaining({
          stackName: 'ms-stackset',
          templateUrl: 'https://tpl/ss',
          profile: 'aws-profile',
        }),
      );
      expect(aws.buildStackSetWrapperParams).toHaveBeenCalledWith({
        externalId: 'ext_1',
        roleName: 'MilkstrawRole',
        milkstrawPrincipal: '999999999999',
        organizationId: 'r-1234',
      });
      expect(api.reportStacksUpdated).toHaveBeenCalledWith('tok', 'org_1');
    });

    it('throws when rootId is missing for stackset update', async () => {
      vi.mocked(api.getOrganization).mockResolvedValue({
        ...mockOrgDetails,
        rootId: undefined,
      });
      vi.mocked(aws.updateStack).mockResolvedValue({ status: 'UPDATE_COMPLETE' } as any);

      const check = await checkForUpdates('tok', organizationContext);
      await expect(applyUpdates('tok', organizationContext, check)).rejects.toThrow('Organization root ID is required');
    });

    it('updates only the management stack when the stackset is already current', async () => {
      vi.mocked(api.getOrganization).mockResolvedValue({
        ...mockOrgDetails,
        stacks: {
          managementStack: { name: 'ms-stack', version: '1.0' },
          stackset: { name: 'ms-stackset', version: '1.1' },
        },
      });
      vi.mocked(aws.updateStack).mockResolvedValue({ status: 'UPDATE_COMPLETE' } as any);

      const check = await checkForUpdates('tok', organizationContext, 'aws-profile');
      const result = await applyUpdates('tok', organizationContext, check, 'aws-profile');

      expect(check.needsManagementUpdate).toBe(true);
      expect(check.needsStackSetUpdate).toBe(false);
      expect(aws.updateStack).toHaveBeenCalledTimes(1);
      expect(result.updates).toEqual([{ name: 'ms-stack', status: 'UPDATE_COMPLETE' }]);
      expect(api.reportStacksUpdated).toHaveBeenCalledWith('tok', 'org_1');
    });
  });
});
