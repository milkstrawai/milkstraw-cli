import type { Command } from 'commander';
import type { CliContext } from '../core/context.js';
import { UsageError } from '../core/errors.js';
import { performLogin } from '../services/auth/login.js';
import { wrapInteractiveCommand } from './helpers.js';

async function loginHandler(context: CliContext): Promise<void> {
  if (!context.isInteractive) {
    throw new UsageError('Login requires an interactive terminal.');
  }

  await performLogin(context.auth, {
    isInteractive: context.isInteractive,
    agentMode: context.config.agentMode,
  });
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in to MilkStraw AI via browser')
    .action(wrapInteractiveCommand(loginHandler));
}
