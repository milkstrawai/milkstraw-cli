import { describe, expect, it } from 'vitest';
import { buildManagementStackParams, buildStackSetWrapperParams } from '../../../../src/lib/aws/client.js';

describe('buildManagementStackParams', () => {
  it('returns exactly 3 parameters with correct keys and values', () => {
    const result = buildManagementStackParams({
      externalId: 'ext-123',
      roleName: 'MyRole',
      milkstrawPrincipal: 'arn:aws:iam::111111111111:root',
    });

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { ParameterKey: 'ExternalID', ParameterValue: 'ext-123' },
      { ParameterKey: 'RoleName', ParameterValue: 'MyRole' },
      { ParameterKey: 'MilkStrawPrincipal', ParameterValue: 'arn:aws:iam::111111111111:root' },
    ]);
  });
});

describe('buildStackSetWrapperParams', () => {
  it('returns exactly 4 parameters including OrganizationID', () => {
    const result = buildStackSetWrapperParams({
      externalId: 'ext-456',
      roleName: 'OrgRole',
      milkstrawPrincipal: 'arn:aws:iam::222222222222:root',
      organizationId: 'o-abc123',
    });

    expect(result).toHaveLength(4);
    expect(result).toEqual([
      { ParameterKey: 'ExternalID', ParameterValue: 'ext-456' },
      { ParameterKey: 'RoleName', ParameterValue: 'OrgRole' },
      { ParameterKey: 'MilkStrawPrincipal', ParameterValue: 'arn:aws:iam::222222222222:root' },
      { ParameterKey: 'OrganizationID', ParameterValue: 'o-abc123' },
    ]);
  });
});
