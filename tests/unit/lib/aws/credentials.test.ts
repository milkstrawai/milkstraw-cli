import { beforeEach, describe, expect, it, vi } from 'vitest';

const stsMockSend = vi.fn();

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(() => ({ send: stsMockSend })),
  GetCallerIdentityCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cloudformation', () => ({
  CloudFormationClient: vi.fn(() => ({ send: vi.fn() })),
}));

const { CredentialsError } = await import('../../../../src/lib/aws/client.js');
const { validateCredentials } = await import('../../../../src/lib/aws/credentials.js');

beforeEach(() => {
  stsMockSend.mockReset();
});

describe('validateCredentials', () => {
  it('returns account info on success', async () => {
    stsMockSend.mockResolvedValueOnce({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/test',
    });
    const result = await validateCredentials();
    expect(result.accountId).toBe('123456789012');
  });

  it('throws CredentialsError when no credentials', async () => {
    const error = new Error('Could not load credentials');
    (error as any).name = 'CredentialsProviderError';
    stsMockSend.mockRejectedValueOnce(error);
    await expect(validateCredentials()).rejects.toThrow(CredentialsError);
  });

  it('includes profile name in error when profile provided', async () => {
    const error = new Error('Could not load credentials');
    (error as any).name = 'CredentialsProviderError';
    stsMockSend.mockRejectedValueOnce(error);
    await expect(validateCredentials('bad-profile')).rejects.toThrow('bad-profile');
  });

  it('throws when STS returns incomplete caller identity without account id', async () => {
    stsMockSend.mockResolvedValueOnce({
      Arn: 'arn:aws:iam::123456789012:user/test',
    });

    await expect(validateCredentials()).rejects.toThrow('AWS returned incomplete caller identity');
  });

  it('throws when STS returns incomplete caller identity without ARN', async () => {
    stsMockSend.mockResolvedValueOnce({
      Account: '123456789012',
    });

    await expect(validateCredentials()).rejects.toThrow('AWS returned incomplete caller identity');
  });

  it.each([
    'CredentialIsEmpty',
    'ExpiredTokenException',
    'ExpiredToken',
  ])('maps %s to the credentials remediation error', async (errorName) => {
    const error = new Error('credential failure');
    (error as any).name = errorName;
    stsMockSend.mockRejectedValueOnce(error);

    await expect(validateCredentials()).rejects.toThrow('No AWS credentials found.');
  });

  it.each([
    'InvalidIdentityToken',
    'InvalidClientTokenId',
  ])('maps %s to the invalid token remediation error', async (errorName) => {
    const error = new Error('token failure');
    (error as any).name = errorName;
    stsMockSend.mockRejectedValueOnce(error);

    await expect(validateCredentials()).rejects.toThrow('AWS credentials are invalid or expired.');
  });

  it('detects invalid token by error message when error name is unrecognized', async () => {
    const error = new Error('The security token included in the request is invalid.');
    (error as any).name = 'UnrecognizedException';
    stsMockSend.mockRejectedValueOnce(error);

    await expect(validateCredentials()).rejects.toThrow('AWS credentials are invalid or expired.');
  });

  it('includes profile-specific SSO hint for invalid token errors', async () => {
    const error = new Error('token failure');
    (error as any).name = 'InvalidIdentityToken';
    stsMockSend.mockRejectedValueOnce(error);

    await expect(validateCredentials('my-profile')).rejects.toThrow('aws sso login --profile my-profile');
  });

  it('rethrows unknown AWS errors as CredentialsError with the original message', async () => {
    const error = new Error('Access denied by SCP');
    (error as any).name = 'AccessDeniedException';
    stsMockSend.mockRejectedValueOnce(error);

    await expect(validateCredentials()).rejects.toThrow('Access denied by SCP');
  });
});
