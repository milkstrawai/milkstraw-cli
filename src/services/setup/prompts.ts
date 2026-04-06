import { input, select } from '@inquirer/prompts';
import { Chalk } from 'chalk';
import { BackendValidationError, ConfigError } from '../../core/errors.js';
import * as api from '../../lib/api/index.js';
import { CLI_PRIMARY_HEX } from '../../ui/colors.js';

export async function resolveOrganizationForSetup(
  token: string,
  organizationFlag?: string,
): Promise<api.OrganizationListing | null> {
  if (organizationFlag) {
    try {
      return await api.getOrganization(token, organizationFlag);
    } catch (error) {
      if (!(error instanceof BackendValidationError)) throw error;
      // Org not found — fall through to create
    }
  }

  const organizations = await api.listOrganizations(token);

  if (organizations.length === 0) {
    return null;
  }

  const CREATE_NEW = '__create_new__';
  const organizationId = await select({
    message: 'Select an organization:',
    choices: [
      { name: 'Create new organization', value: CREATE_NEW },
      ...organizations.map((organization) => ({
        name: `${organization.name} (${organization.managementAccount.accountId})`,
        value: organization.id,
      })),
    ],
    theme: buildPromptTheme(),
  });

  if (organizationId === CREATE_NEW) {
    return null;
  }

  const selected = organizations.find((organization) => organization.id === organizationId);

  if (!selected) {
    throw new ConfigError(`Selected organization "${organizationId}" was not found.`);
  }

  return selected;
}

export async function promptOrganizationDetails(): Promise<{ name: string }> {
  const name = await input({
    message: 'Organization name:',
    validate: (val) => val.trim().length > 0 || 'Organization name is required.',
    theme: buildPromptTheme(),
  });

  return { name: name.trim() };
}

function buildPromptTheme() {
  const chalk = new Chalk({ level: 3 });

  return {
    style: {
      answer: (text: string) => chalk.hex(CLI_PRIMARY_HEX)(text),
    },
  };
}
