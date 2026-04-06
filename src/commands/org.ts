import type { Command } from 'commander';
import { ParagraphComponent } from '../components/paragraph.js';
import { TableComponent } from '../components/table.js';
import type { CliContext } from '../core/context.js';
import { prettyJson } from '../lib/json.js';
import { listOrganizations } from '../services/organizations/index.js';
import { requireToken, wrapCommand } from './helpers.js';

export function registerOrgCommand(program: Command): void {
  const organizationCommand = program.command('org').description('Manage organizations');

  organizationCommand
    .command('list')
    .description('List accessible organizations')
    .action(wrapCommand(organizationListHandler));
}

async function organizationListHandler(context: CliContext): Promise<string> {
  const token = await requireToken(context);
  const organizations = await listOrganizations(token);
  const rows = organizations.map((org) => ({
    name: org.name,
    id: org.id,
    onboarding: org.onboarding,
    managementAccountId: org.managementAccountId,
  }));

  const summary = `${organizations.length} organization${organizations.length === 1 ? '' : 's'}`;

  if (context.config.isQuiet) {
    return prettyJson(
      rows.map(({ id, name }) => ({
        id,
        name,
      })),
    );
  }

  if (context.config.renderFormat === 'json') {
    return prettyJson(rows);
  }

  const summaryBlock = new ParagraphComponent(summary).render(context.config.renderFormat);

  if (rows.length === 0) {
    return `${summaryBlock}\n\nNo organizations found.`;
  }

  const tableBlock = new TableComponent({
    rows,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'id', label: 'ID' },
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'managementAccountId', label: 'Management account' },
    ],
  }).render(context.config.renderFormat);

  return `${summaryBlock}\n\n${tableBlock}`;
}
