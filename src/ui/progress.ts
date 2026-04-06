import ora, { type Ora } from 'ora';
import type { CliContext } from '../core/context.js';
import type { UiOptions } from './banners.js';

interface ProgressIndicator {
  start(message: string): void;
  update(message: string): void;
  succeed(message: string): void;
  warn(message: string): void;
  fail(message: string): void;
  stop(): void;
}

/**
 * Creates a progress indicator that respects agent/non-interactive mode.
 * In agent mode or non-interactive: no-op (silent).
 * In interactive mode: uses ora spinner.
 */
export function createProgress(options: UiOptions): ProgressIndicator {
  if (!options.isInteractive || options.agentMode) {
    return {
      start() {},
      update() {},
      succeed() {},
      warn() {},
      fail() {},
      stop() {},
    };
  }

  let spinner: Ora | null = null;

  return {
    start(message: string) {
      spinner = ora({ text: message }).start();
    },
    update(message: string) {
      if (spinner) spinner.text = message;
    },
    succeed(message: string) {
      if (spinner) spinner.succeed(message);
      spinner = null;
    },
    warn(message: string) {
      if (spinner) spinner.warn(message);
      spinner = null;
    },
    fail(message: string) {
      if (spinner) spinner.fail(message);
      spinner = null;
    },
    stop() {
      if (spinner) spinner.stop();
      spinner = null;
    },
  };
}

export function createProgressFromContext(context: CliContext): ProgressIndicator {
  return createProgress({
    isInteractive: context.isInteractive,
    agentMode: context.config.agentMode,
  });
}
