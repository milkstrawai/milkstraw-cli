import type { Command } from 'commander';
import { resolveOrganizationFromContext } from '../context/organization.js';
import { PERMISSION_ACTIONS, withPermissionCheck } from '../context/permissions.js';
import type { CliContext } from '../core/context.js';
import { UsageError } from '../core/errors.js';
import { applyUpdates, checkForUpdates } from '../services/update/index.js';
import { printInfo, printStep } from '../ui/banners.js';
import { createProgressFromContext } from '../ui/progress.js';
import { confirmAction } from '../ui/prompts.js';
import { requireToken, wrapInteractiveCommand } from './helpers.js';

async function updateHandler(context: CliContext, options: Record<string, unknown>): Promise<void> {
  if (!context.isInteractive) {
    throw new UsageError('Update requires an interactive terminal.');
  }

  const token = await requireToken(context);
  const organizationContext = await resolveOrganizationFromContext(context, token, options.org as string | undefined);
  const awsProfile = context.config.awsProfile;
  const uiOptions = { isInteractive: context.isInteractive, agentMode: context.config.agentMode };

  const check = await withPermissionCheck(
    () => checkForUpdates(token, organizationContext, awsProfile),
    PERMISSION_ACTIONS.UPDATE_STACKS,
    organizationContext.organizationId,
    organizationContext.organizationName,
  );

  if (!check.needsManagementUpdate && !check.needsStackSetUpdate) {
    printStep('Everything is up to date.', uiOptions);
    return;
  }

  printStep(`Organization: ${check.organizationDetails.name}`, uiOptions);
  printStep('Available updates:', uiOptions);

  for (const update of check.updates) {
    printInfo(`  ${update.name}: v${update.from ?? '?'} -> v${update.to}`, uiOptions);
  }

  const shouldUpdate = await confirmAction('  Apply all updates?');

  if (!shouldUpdate) {
    printStep('Update cancelled.', uiOptions);
    return;
  }

  const progress = createProgressFromContext(context);
  progress.start('Updating stacks...');

  await withPermissionCheck(
    () => applyUpdates(token, organizationContext, check, awsProfile),
    PERMISSION_ACTIONS.UPDATE_STACKS,
    organizationContext.organizationId,
    organizationContext.organizationName,
  );

  progress.succeed('Stacks updated');
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update deployed stacks to latest template version')
    .action(wrapInteractiveCommand(updateHandler));
}
