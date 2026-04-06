import { AuthRequiredError } from '../../../core/errors.js';
import { performLogin } from '../../auth/login.js';
import type { SetupInput, SetupState } from '../types.js';

export async function authenticateStep(input: SetupInput, state: SetupState): Promise<void> {
  const token = state.token ?? (await input.context.auth.getToken());

  if (token) {
    state.token = token;
    return;
  }

  if (!input.context.isInteractive) {
    throw new AuthRequiredError();
  }

  state.token = await performLogin(input.context.auth, {
    isInteractive: input.context.isInteractive,
    agentMode: input.context.config.agentMode,
  });
}
