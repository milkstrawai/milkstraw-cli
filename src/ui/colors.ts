import type { Chalk } from 'chalk';

export const CLI_PRIMARY_HEX = '#ff4b24';

type ChalkInstance = InstanceType<typeof Chalk>;

export function colorPrimary(chalk: ChalkInstance, text: string): string {
  return chalk.hex(CLI_PRIMARY_HEX)(text);
}

export function colorPrimaryBold(chalk: ChalkInstance, text: string): string {
  return chalk.hex(CLI_PRIMARY_HEX).bold(text);
}
