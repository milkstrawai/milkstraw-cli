import type { Command } from 'commander';
import { ParagraphComponent } from '../components/paragraph.js';
import { SectionComponent } from '../components/section.js';
import { resolveOrganizationFromContext } from '../context/organization.js';
import { PERMISSION_ACTIONS, withPermissionCheck } from '../context/permissions.js';
import type { CliContext } from '../core/context.js';
import { prettyJson } from '../lib/json.js';
import { getStatus } from '../services/status/index.js';
import { requireToken, wrapCommand } from './helpers.js';

async function statusHandler(context: CliContext, options: Record<string, unknown>): Promise<string> {
  const token = await requireToken(context);
  const organizationContext = await resolveOrganizationFromContext(context, token, options.org as string | undefined);
  const awsProfile = context.config.awsProfile;

  const statusData = await withPermissionCheck(
    () => getStatus(token, organizationContext, awsProfile),
    PERMISSION_ACTIONS.VIEW_STATUS,
    organizationContext.organizationId,
    organizationContext.organizationName,
  );

  if (context.config.isQuiet) {
    return prettyJson({
      organization: {
        id: statusData.organization.id,
        name: statusData.organization.name,
      },
      managementStack: {
        healthy: statusData.managementStack.healthy,
        status: statusData.managementStack.status,
      },
      stackSet: {
        healthy: statusData.stackSet.healthy,
        status: statusData.stackSet.status,
      },
      subAccounts: {
        total: statusData.subAccounts.total,
        statuses: {
          granted: statusData.subAccounts.granted,
          denied: statusData.subAccounts.byStatus.denied.length,
          suspended: statusData.subAccounts.byStatus.suspended.length,
          closed: statusData.subAccounts.byStatus.closed.length,
        },
      },
    });
  }

  if (context.config.renderFormat === 'json') {
    return prettyJson(statusData);
  }

  return [
    new ParagraphComponent(`Status for ${statusData.organization.name}`).render(context.config.renderFormat),
    new SectionComponent({
      title: 'Organization',
      lines: [
        statusData.organization.name,
        `ID ${statusData.organization.id}`,
        `Onboarding ${toInlinePhrase(statusData.organization.onboarding)}`,
      ],
    }).render(context.config.renderFormat),
    new SectionComponent({
      title: 'Management Account',
      lines: [`${statusData.managementAccount.accountId} (${toInlinePhrase(statusData.managementAccount.access)})`],
    }).render(context.config.renderFormat),
    new SectionComponent({
      title: 'Management Stack',
      lines: formatStackLines(statusData.managementStack),
    }).render(context.config.renderFormat),
    new SectionComponent({
      title: 'Stack Set',
      lines: formatStackSetLines(statusData.stackSet),
    }).render(context.config.renderFormat),
    new SectionComponent({
      title: 'Sub Accounts',
      lines: formatSubAccountLines(statusData.subAccounts),
    }).render(context.config.renderFormat),
  ].join('\n\n');
}

export function registerStatusCommand(program: Command): void {
  program.command('status').description('Check connection and stack status').action(wrapCommand(statusHandler));
}

function toInlinePhrase(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ');
}

function toSentencePhrase(value: string): string {
  const normalized = toInlinePhrase(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatVersionLine(deployedVersion: string | null, latestVersion: string): string {
  if (!deployedVersion) return `Latest version ${latestVersion}`;
  if (deployedVersion === latestVersion) return `Version ${deployedVersion}`;

  return `Version ${deployedVersion} (latest ${latestVersion})`;
}

function formatStackLines(stack: {
  name: string | null;
  healthy: boolean;
  status: string;
  deployedVersion: string | null;
  latestVersion: string;
}): string[] {
  return [
    ...(stack.name ? [stack.name] : []),
    stack.healthy ? 'Healthy' : toSentencePhrase(stack.status),
    formatVersionLine(stack.deployedVersion, stack.latestVersion),
  ];
}

function formatStackSetLines(stackSet: {
  name: string | null;
  healthy: boolean;
  status: string;
  deployedVersion: string | null;
  latestVersion: string;
}): string[] {
  if (stackSet.status === 'not_deployed') {
    return ['Not deployed', `Latest version ${stackSet.latestVersion}`];
  }

  return formatStackLines(stackSet);
}

function formatSubAccountLines(subAccounts: {
  total: number;
  granted: number;
  byStatus: {
    granted: Array<{ accountId: string }>;
    denied: Array<{ accountId: string }>;
    suspended: Array<{ accountId: string }>;
    closed: Array<{ accountId: string }>;
  };
}): string[] {
  if (subAccounts.total === 0) {
    return ['No subaccounts connected'];
  }

  const deniedCount = subAccounts.byStatus.denied.length;
  const suspendedCount = subAccounts.byStatus.suspended.length;
  const closedCount = subAccounts.byStatus.closed.length;

  if (subAccounts.granted === subAccounts.total && deniedCount === 0 && suspendedCount === 0 && closedCount === 0) {
    return [`All ${subAccounts.total} subaccounts granted access.`];
  }

  const lines = [`Granted: ${subAccounts.granted}`];

  if (deniedCount > 0) {
    lines.push(`Denied: ${deniedCount}`);
    lines.push(`Denied accounts: ${subAccounts.byStatus.denied.map((account) => account.accountId).join(', ')}`);
  }

  if (suspendedCount > 0) {
    lines.push(`Suspended: ${suspendedCount}`);
    lines.push(`Suspended accounts: ${subAccounts.byStatus.suspended.map((account) => account.accountId).join(', ')}`);
  }

  if (closedCount > 0) {
    lines.push(`Closed: ${closedCount}`);
    lines.push(`Closed accounts: ${subAccounts.byStatus.closed.map((account) => account.accountId).join(', ')}`);
  }

  return lines;
}
