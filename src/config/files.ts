import { homedir } from 'node:os';
import { join } from 'node:path';

export function getConfigDir(): string {
  return join(homedir(), '.config', 'milkstraw-cli');
}
