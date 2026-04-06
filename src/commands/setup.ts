import { setTimeout as sleep } from 'node:timers/promises';
import type { Command } from 'commander';
import open from 'open';
import type { CliContext } from '../core/context.js';
import { UsageError } from '../core/errors.js';
import { runSetup } from '../services/setup/run-setup.js';
import { printBanner, printCompletionBox, printSubtle, printSuccess, printWarning } from '../ui/banners.js';
import { createProgress } from '../ui/progress.js';
import { wrapInteractiveCommand } from './helpers.js';

async function setupHandler(context: CliContext, options: Record<string, unknown>): Promise<void> {
  if (!context.isInteractive) {
    throw new UsageError('Setup requires an interactive terminal.');
  }

  const uiOptions = { isInteractive: true, agentMode: false };

  printBanner('MilkStraw AI - CLI Setup', uiOptions);

  const progress = createProgress(uiOptions);
  let activeStep: string | null = null;

  function stopActive(): void {
    if (activeStep) {
      progress.stop();
      activeStep = null;
    }
  }

  try {
    const result = await runSetup({
      context,
      organizationFlag: options.org as string | undefined,
      awsProfile: context.config.awsProfile,
      onStepStart: (step) => {
        stopActive();
        progress.start(step);
        activeStep = step;
      },
      onStepSuccess: (step) => {
        if (activeStep) {
          progress.succeed(step);
          activeStep = null;
          return;
        }
        printSuccess(step, uiOptions);
      },
      onInfo: (message) => {
        stopActive();
        printSubtle(message, uiOptions);
      },
      onWarning: (message) => {
        stopActive();
        printWarning(message, uiOptions);
      },
      onProgress: (message) => {
        if (!activeStep) {
          progress.start(message);
          activeStep = message;
          return;
        }
        progress.update(message);
      },
    });

    stopActive();

    if (result.notices) {
      for (const notice of result.notices) {
        printSubtle(notice, uiOptions);
      }
    }

    if (result.warnings) {
      for (const warning of result.warnings) {
        printWarning(warning, uiOptions);
      }
    }

    printCompletionBox(buildCompletionLines(result), uiOptions);

    try {
      await sleep(1000);
      await open(result.dashboardUrl);
    } catch {
      /* ignore */
    }
  } finally {
    if (activeStep) {
      progress.stop();
    }
  }
}

function buildCompletionLines(result: Awaited<ReturnType<typeof runSetup>>): string[] {
  const lines = ['Setup complete!'];

  if (result.onboardingStatus !== 'complete') {
    lines.push(`Status: ${result.onboardingStatus}`);
  }

  lines.push(`Dashboard: ${result.dashboardUrl}`);

  return lines;
}

export function registerSetupCommand(program: Command): void {
  program.command('setup').description('Complete MilkStraw AI onboarding').action(wrapInteractiveCommand(setupHandler));
}
