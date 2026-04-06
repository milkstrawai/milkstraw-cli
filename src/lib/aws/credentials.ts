import { GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { hasName } from '../type-guards.js';
import { CredentialsError, createStsClient, throwIfInvalidToken } from './client.js';

export const CREDENTIAL_ERROR_NAMES = new Set([
  'CredentialsProviderError',
  'CredentialIsEmpty',
  'ExpiredTokenException',
  'ExpiredToken',
]);

export async function validateCredentials(profile?: string): Promise<{ accountId: string; arn: string }> {
  const sts = createStsClient(profile);

  try {
    const result = await sts.send(new GetCallerIdentityCommand({}));

    if (!result.Account || !result.Arn) {
      throw new CredentialsError('AWS returned incomplete caller identity. Check your credentials.');
    }

    return {
      accountId: result.Account,
      arn: result.Arn,
    };
  } catch (error: unknown) {
    if (error instanceof CredentialsError) throw error;

    if (hasName(error) && CREDENTIAL_ERROR_NAMES.has(error.name)) {
      throw new CredentialsError(formatCredentialsHint(profile));
    }

    throwIfInvalidToken(error, profile);

    throw new CredentialsError(error instanceof Error ? error.message : String(error));
  }
}

export function formatCredentialsHint(profile?: string): string {
  return (
    `No AWS credentials found.\n\n` +
    `  Configure credentials using one of:\n` +
    `    $ aws configure                    # Access key + secret\n` +
    `    $ aws configure sso                # SSO login\n` +
    `    $ export AWS_ACCESS_KEY_ID=...     # Environment variables\n` +
    (profile ? `\n  Profile "${profile}" may not exist or is misconfigured.\n` : '') +
    `\n  Then re-run: milkstraw setup or milkstraw update`
  );
}
