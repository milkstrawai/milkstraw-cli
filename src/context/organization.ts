import { select } from '@inquirer/prompts';
import type { CliContext } from '../core/context.js';
import { ConfigError } from '../core/errors.js';
import { listOrganizations } from '../lib/api/index.js';

export interface OrganizationContext {
  organizationId: string;
  organizationName: string;
  source: 'flag' | 'env' | 'auto' | 'interactive';
}

interface OrganizationResolverInput {
  flagOrganizationId?: string;
  environmentOrganizationId?: string;
  isInteractive: boolean;
  token: string;
}

function buildOrganizationResolverInput(
  context: CliContext,
  token: string,
  flagOrganizationId?: string,
): OrganizationResolverInput {
  return {
    flagOrganizationId,
    environmentOrganizationId: context.config.environmentOrganizationId,
    isInteractive: context.isInteractive,
    token,
  };
}

export async function resolveOrganizationContext(input: OrganizationResolverInput): Promise<OrganizationContext> {
  const candidates: Array<{ id: string; source: OrganizationContext['source'] }> = [];

  if (input.flagOrganizationId) candidates.push({ id: input.flagOrganizationId, source: 'flag' });
  if (input.environmentOrganizationId) candidates.push({ id: input.environmentOrganizationId, source: 'env' });
  const accessibleOrganizations = await listOrganizations(input.token);

  if (accessibleOrganizations.length === 0) {
    throw new ConfigError('No organizations found. Run `milkstraw setup` to create one.');
  }

  for (const candidate of candidates) {
    const matching = accessibleOrganizations.find((organization) => organization.id === candidate.id);

    if (matching) {
      return {
        organizationId: matching.id,
        organizationName: matching.name,
        source: candidate.source,
      };
    }

    if (candidate.source === 'flag' || candidate.source === 'env') {
      throw new ConfigError(
        `Organization "${candidate.id}" is not accessible. ` +
          `You may not have access, or the ID may be incorrect. ` +
          `Run \`milkstraw org list\` to see your accessible organizations.`,
      );
    }
  }

  if (accessibleOrganizations.length === 1) {
    return {
      organizationId: accessibleOrganizations[0].id,
      organizationName: accessibleOrganizations[0].name,
      source: 'auto',
    };
  }

  if (input.isInteractive) {
    const organizationId = await select({
      message: 'Select an organization:',
      choices: accessibleOrganizations.map((organization) => ({
        name: `${organization.name} (${organization.managementAccount.accountId})`,
        value: organization.id,
      })),
    });

    const selected = accessibleOrganizations.find((organization) => organization.id === organizationId);
    if (!selected) throw new ConfigError(`Organization ${organizationId} not found.`);

    return {
      organizationId: selected.id,
      organizationName: selected.name,
      source: 'interactive',
    };
  }

  throw new ConfigError('No organization specified. Use --org or set MILKSTRAW_ORG.');
}

export function resolveOrganizationFromContext(
  context: CliContext,
  token: string,
  flagOrganizationId?: string,
): Promise<OrganizationContext> {
  return resolveOrganizationContext(buildOrganizationResolverInput(context, token, flagOrganizationId));
}
