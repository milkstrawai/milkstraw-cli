import { Chalk } from 'chalk';
import { colorPrimary, colorPrimaryBold } from './colors.js';

export interface UiOptions {
  isInteractive: boolean;
  agentMode: boolean;
}

const chalk = new Chalk({ level: 3 });

export function printBanner(title: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log();
  console.log(colorPrimary(chalk, '  ╔═══════════════════════════════════════╗'));
  console.log(colorPrimary(chalk, `  ║       ${title.padEnd(32)}║`));
  console.log(colorPrimary(chalk, '  ╚═══════════════════════════════════════╝'));
  console.log();
}

export function printStep(step: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(chalk.bold(`  ${step}`));
}

export function printSuccess(message: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(chalk.green(`✔ ${message}`));
}

export function printInfo(message: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(`  ${message}`);
}

export function printSubtle(message: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(chalk.dim(`  ${message}`));
}

export function printWarning(message: string, options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(chalk.yellow(`  ${message}`));
}

export function printCompletionBox(lines: string[], options: UiOptions): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log();
  console.log(chalk.green('  ═══════════════════════════════════════'));

  for (const line of lines) {
    console.log(chalk.green(`  ${line}`));
  }

  console.log(chalk.green('  ═══════════════════════════════════════'));
  console.log();
}

export function printDeviceCode(
  userCode: string,
  verificationUrl: string,
  browserOpened: boolean,
  options: UiOptions,
): void {
  if (!options.isInteractive || options.agentMode) return;

  console.log(`  Your verification code: ${colorPrimaryBold(chalk, userCode)}`);

  if (browserOpened) {
    console.log(`  Browser opened to: ${verificationUrl}`);
  } else {
    console.log(`  Open this URL in your browser: ${chalk.underline(verificationUrl)}`);
  }

  console.log();
}
