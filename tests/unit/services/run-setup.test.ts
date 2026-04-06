import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateStepMock,
  resolveOrganizationStepMock,
  validateAwsStepMock,
  prepareDeploymentStepMock,
  deployManagementStackStepMock,
  verifyManagementAccountStepMock,
  deployStackSetStepMock,
  verifySubaccountsStepMock,
  finalizeStepMock,
} = vi.hoisted(() => ({
  authenticateStepMock: vi.fn(),
  resolveOrganizationStepMock: vi.fn(),
  validateAwsStepMock: vi.fn(),
  prepareDeploymentStepMock: vi.fn(),
  deployManagementStackStepMock: vi.fn(),
  verifyManagementAccountStepMock: vi.fn(),
  deployStackSetStepMock: vi.fn(),
  verifySubaccountsStepMock: vi.fn(),
  finalizeStepMock: vi.fn(),
}));

vi.mock('../../../src/services/setup/steps/authenticate.js', () => ({
  authenticateStep: authenticateStepMock,
}));

vi.mock('../../../src/services/setup/steps/resolve-organization.js', () => ({
  resolveOrganizationStep: resolveOrganizationStepMock,
}));

vi.mock('../../../src/services/setup/steps/validate-aws.js', () => ({
  validateAwsStep: validateAwsStepMock,
}));

vi.mock('../../../src/services/setup/steps/prepare-deployment.js', () => ({
  prepareDeploymentStep: prepareDeploymentStepMock,
}));

vi.mock('../../../src/services/setup/steps/deploy-management-stack.js', () => ({
  deployManagementStackStep: deployManagementStackStepMock,
}));

vi.mock('../../../src/services/setup/steps/verify-management-account.js', () => ({
  verifyManagementAccountStep: verifyManagementAccountStepMock,
}));

vi.mock('../../../src/services/setup/steps/deploy-stackset.js', () => ({
  deployStackSetStep: deployStackSetStepMock,
}));

vi.mock('../../../src/services/setup/steps/verify-subaccounts.js', () => ({
  verifySubaccountsStep: verifySubaccountsStepMock,
}));

vi.mock('../../../src/services/setup/steps/finalize.js', () => ({
  finalizeStep: finalizeStepMock,
}));

import { runSetup } from '../../../src/services/setup/run-setup.js';

describe('services/setup/runSetup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    finalizeStepMock.mockReturnValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
      dashboardUrl: 'https://app.milkstraw.ai/orgs/org_1',
      onboardingStatus: 'complete',
      breadcrumbs: [],
    });
  });

  it('runs setup steps in order and shares one mutable state object', async () => {
    const onStepStart = vi.fn();
    const onStepSuccess = vi.fn();
    const input = {
      context: {
        config: { apiUrl: 'https://app.milkstraw.ai' },
        auth: { getToken: vi.fn().mockResolvedValue('tok_123') },
      },
      onStepStart,
      onStepSuccess,
    } as any;
    const order: string[] = [];

    const stepMocks = [
      ['authenticate', authenticateStepMock],
      ['resolve-organization', resolveOrganizationStepMock],
      ['validate-aws', validateAwsStepMock],
      ['prepare-deployment', prepareDeploymentStepMock],
      ['deploy-management-stack', deployManagementStackStepMock],
      ['verify-management-account', verifyManagementAccountStepMock],
      ['deploy-stackset', deployStackSetStepMock],
      ['verify-subaccounts', verifySubaccountsStepMock],
    ] as const;

    for (const [label, stepMock] of stepMocks) {
      stepMock.mockImplementation(async (_input, state) => {
        order.push(label);
        state[label] = true;
      });
    }

    const result = await runSetup(input);

    expect(result).toEqual({
      organizationId: 'org_1',
      organizationName: 'Acme',
      dashboardUrl: 'https://app.milkstraw.ai/orgs/org_1',
      onboardingStatus: 'complete',
      breadcrumbs: [],
    });
    expect(order).toEqual([
      'authenticate',
      'resolve-organization',
      'validate-aws',
      'prepare-deployment',
      'deploy-management-stack',
      'verify-management-account',
      'deploy-stackset',
      'verify-subaccounts',
    ]);
    expect(finalizeStepMock).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        authenticate: true,
        'resolve-organization': true,
        'validate-aws': true,
        'prepare-deployment': true,
        'deploy-management-stack': true,
        'verify-management-account': true,
        'deploy-stackset': true,
        'verify-subaccounts': true,
      }),
    );
    expect(onStepStart.mock.calls).toEqual([
      ['Authenticating'],
      ['Resolving organization'],
      ['Validating AWS credentials'],
      ['Preparing deployment'],
    ]);
    expect(onStepSuccess.mock.calls).toEqual([
      ['Authenticated'],
      ['Organization resolved'],
      ['AWS credentials validated'],
      ['Deployment plan ready'],
    ]);
  });

  it('stops the pipeline when a step fails', async () => {
    const error = new Error('aws mismatch');
    validateAwsStepMock.mockRejectedValue(error);

    await expect(runSetup({ context: { auth: { getToken: vi.fn().mockResolvedValue(null) } } } as any)).rejects.toThrow(
      error,
    );

    expect(prepareDeploymentStepMock).not.toHaveBeenCalled();
    expect(deployManagementStackStepMock).not.toHaveBeenCalled();
    expect(finalizeStepMock).not.toHaveBeenCalled();
  });
});
