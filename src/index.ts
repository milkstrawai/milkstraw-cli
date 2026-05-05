import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

function readVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program.name('milkstraw').description('MilkStraw AI CLI - AI-powered cloud cost optimization').version(readVersion());

// Global options
program.option('--org <id>', 'Organization ID');
program.option('--aws-profile <name>', 'AWS profile name override');
program.option('--json', 'Output as JSON');
program.option('--quiet', 'Output data only');
program.option('--markdown', 'Output as markdown');
program.option('--verbose', 'Verbose output');
program.option('--agent', 'Agent-safe mode (no spinners, no prompts, machine-friendly output)');

async function main() {
  const { registerLoginCommand } = await import('./commands/login.js');
  const { registerLogoutCommand } = await import('./commands/logout.js');
  const { registerSetupCommand } = await import('./commands/setup.js');
  const { registerStatusCommand } = await import('./commands/status.js');
  const { registerUpdateCommand } = await import('./commands/update.js');
  const { registerOrgCommand } = await import('./commands/org.js');
  const { registerInventoryCommand } = await import('./commands/inventory.js');
  const { registerCommitmentsCommand } = await import('./commands/commitments.js');

  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerSetupCommand(program);
  registerStatusCommand(program);
  registerUpdateCommand(program);
  registerOrgCommand(program);
  registerInventoryCommand(program);
  registerCommitmentsCommand(program);

  await program.parseAsync(process.argv);
}

main().catch(async (error) => {
  const { handleError } = await import('./core/cli.js');
  process.exitCode = handleError(error);
});
