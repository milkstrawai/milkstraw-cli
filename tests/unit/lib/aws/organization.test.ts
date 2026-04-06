import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationsMockSend = vi.fn();
const cfnMockSend = vi.fn();
const activateOrganizationsAccessCommand = vi.fn();

vi.mock('@aws-sdk/client-organizations', () => ({
  OrganizationsClient: vi.fn(() => ({ send: organizationsMockSend })),
  DescribeOrganizationCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cloudformation', () => ({
  ActivateOrganizationsAccessCommand: activateOrganizationsAccessCommand,
  CloudFormationClient: vi.fn(() => ({ send: cfnMockSend })),
}));

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(() => ({ send: vi.fn() })),
}));

const { CredentialsError, AwsPermissionsError } = await import('../../../../src/lib/aws/client.js');
const { discoverManagementAccountId, enableStackSetsTrustedAccess } = await import(
  '../../../../src/lib/aws/organization.js'
);

beforeEach(() => {
  organizationsMockSend.mockReset();
  cfnMockSend.mockReset();
  activateOrganizationsAccessCommand.mockReset();
});

describe('discoverManagementAccountId', () => {
  it('returns the management account ID on success', async () => {
    organizationsMockSend.mockResolvedValueOnce({
      Organization: { MasterAccountId: '123456789012' },
    });

    await expect(discoverManagementAccountId()).resolves.toBe('123456789012');
  });

  it('throws CredentialsError when no credentials are available', async () => {
    const error = new Error('Could not load credentials');
    (error as any).name = 'CredentialsProviderError';
    organizationsMockSend.mockRejectedValueOnce(error);

    await expect(discoverManagementAccountId()).rejects.toThrow(CredentialsError);
  });

  it('throws AwsPermissionsError when organizations access is denied', async () => {
    const error = new Error('Access denied');
    (error as any).name = 'AccessDeniedException';
    organizationsMockSend.mockRejectedValueOnce(error);

    await expect(discoverManagementAccountId()).rejects.toThrow(AwsPermissionsError);
  });

  it('throws a clear error when AWS Organizations is not enabled', async () => {
    const error = new Error('Not in use');
    (error as any).name = 'AWSOrganizationsNotInUseException';
    organizationsMockSend.mockRejectedValueOnce(error);

    await expect(discoverManagementAccountId()).rejects.toThrow('not part of an AWS Organization');
  });

  it('throws when AWS returns an invalid management account ID', async () => {
    organizationsMockSend.mockResolvedValueOnce({
      Organization: { MasterAccountId: 'invalid' },
    });

    await expect(discoverManagementAccountId()).rejects.toThrow('invalid organization response');
  });
});

describe('enableStackSetsTrustedAccess', () => {
  it('activates CloudFormation organizations access', async () => {
    cfnMockSend.mockResolvedValueOnce({});

    await expect(enableStackSetsTrustedAccess()).resolves.toBeUndefined();

    expect(activateOrganizationsAccessCommand).toHaveBeenCalledWith({});
    expect(cfnMockSend).toHaveBeenCalledTimes(1);
  });
});
