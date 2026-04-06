import { confirm } from '@inquirer/prompts';

export function confirmAction(message: string): Promise<boolean> {
  return confirm({ message, default: true });
}
