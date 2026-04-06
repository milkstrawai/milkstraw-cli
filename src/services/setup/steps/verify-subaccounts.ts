import { setTimeout as sleep } from 'node:timers/promises';
import * as api from '../../../lib/api/index.js';
import { requireState, type SetupInput, type SetupState } from '../types.js';

const MAX_RETRIES = 5;
const BACKOFF = [1, 2, 4, 8];

export async function verifySubaccountsStep(input: SetupInput, state: SetupState): Promise<void> {
  const verified = requireState(state.managementAccountVerification, 'managementAccountVerification');

  if (verified.onboarding === 'complete') {
    state.subaccountVerification = verified;
    return;
  }

  input.onStepStart?.('Verifying subaccounts');
  const token = requireState(state.token, 'token');
  const organization = requireState(state.organization, 'organization');
  let result: api.Organization = verified;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    input.onProgress?.(`Verifying subaccounts... attempt ${attempt}/${MAX_RETRIES}`);
    result = await api.verifyAccounts(token, organization.id);

    if (result.onboarding === 'complete') break;

    if (attempt < MAX_RETRIES) {
      const wait = BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)];
      await sleep(wait * 1000);
    }
  }

  state.subaccountVerification = result;
  input.onStepSuccess?.(
    result.onboarding === 'complete' ? 'Subaccounts verified' : 'Subaccount verification still in progress',
  );
}
