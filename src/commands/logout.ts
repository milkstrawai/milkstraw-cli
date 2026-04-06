import type { Command } from 'commander';
import { ParagraphComponent } from '../components/paragraph.js';
import type { CliContext } from '../core/context.js';
import { prettyJson } from '../lib/json.js';
import { performLogout } from '../services/auth/logout.js';
import { wrapCommand } from './helpers.js';

async function logoutHandler(context: CliContext): Promise<string> {
  const result = await performLogout(context.auth);
  const summary = logoutSummary(result.localCleared, result.revoked);
  const data = { loggedOut: result.localCleared, revoked: result.revoked };

  if (context.config.isQuiet || context.config.renderFormat === 'json') {
    return prettyJson(data);
  }

  return new ParagraphComponent(summary).render(context.config.renderFormat);
}

export function registerLogoutCommand(program: Command): void {
  program.command('logout').description('Log out and revoke token').action(wrapCommand(logoutHandler));
}

function logoutSummary(localCleared: boolean, revoked: boolean): string {
  if (!localCleared) return 'Already logged out.';
  if (revoked) return 'Token revoked. Logged out.';

  return 'Logged out.';
}
