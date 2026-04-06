import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/api/index.js', () => ({
  getOrganization: vi.fn(),
  getCloudFormationTemplates: vi.fn(),
  verifyManagementAccount: vi.fn(),
  verifyAccounts: vi.fn(),
  createOrganization: vi.fn(),
}));

vi.mock('../../src/lib/aws/index.js', () => ({
  validateCredentials: vi.fn(),
  discoverManagementAccountId: vi.fn(),
  deployStack: vi.fn(),
  buildManagementStackParams: vi.fn().mockReturnValue([]),
  buildStackSetWrapperParams: vi.fn().mockReturnValue([]),
  AwsPermissionsError: class AwsPermissionsError extends Error {},
}));

vi.mock('../../src/services/setup/prompts.js', () => ({
  resolveOrganizationForSetup: vi.fn(),
  promptOrganizationDetails: vi.fn(),
}));

vi.mock('../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn(),
}));

vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

import type { TokenStore } from '../../src/auth/session.js';
import { resolveOrganizationFromContext } from '../../src/context/organization.js';
import type { CliContext } from '../../src/core/context.js';
import * as api from '../../src/lib/api/index.js';
import * as aws from '../../src/lib/aws/index.js';
import { promptOrganizationDetails, resolveOrganizationForSetup } from '../../src/services/setup/prompts.js';
import { runSetup } from '../../src/services/setup/run-setup.js';

function mockSession(token: string | null = 'tok_123'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn().mockResolvedValue(undefined),
    clearToken: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockResolvedValue(!!token),
  };
}

function mockCtx(overrides: Partial<CliContext> = {}): CliContext {
  return {
    config: {
      apiUrl: 'https://app.milkstraw.ai',
      renderFormat: 'text',
      isQuiet: false,
      verbose: false,
      agentMode: false,
    },
    auth: mockSession(),
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
    ...overrides,
  };
}

const existingOrg = {
  id: 'org_1',
  name: 'Existing Org',
  onboarding: 'pending',
  managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  externalId: 'ext_1',
  roleName: 'MilkstrawRole',
} as any;

const createdOrg = {
  ...existingOrg,
  id: 'org_new',
  name: 'Created Org',
};

const templates = {
  templates: {
    management: { name: 'ms-stack', version: '1.0', url: 'https://tpl/mgmt' },
    stackset: { name: 'ms-stackset', version: '1.0', url: 'https://tpl/stackset' },
  },
  milkstrawAccountId: '999999999999',
} as any;

describe('setup orchestration integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getCloudFormationTemplates).mockResolvedValue(templates);
    vi.mocked(api.getOrganization).mockResolvedValue(existingOrg);
    vi.mocked(api.verifyManagementAccount).mockResolvedValue({ ...existingOrg, onboarding: 'complete' });
    vi.mocked(api.verifyAccounts).mockResolvedValue({ ...existingOrg, onboarding: 'complete' });
    vi.mocked(aws.validateCredentials).mockResolvedValue({
      accountId: '111111111111',
      arn: 'arn:aws:iam::111111111111:role/Admin',
    } as any);
    vi.mocked(aws.deployStack).mockResolvedValue({
      skipped: false,
      status: 'CREATE_COMPLETE',
      stackId: 'stack-1',
    } as any);
  });

  it('covers existing-org onboarding through the orchestrator', async () => {
    vi.mocked(resolveOrganizationForSetup).mockResolvedValue(existingOrg);

    const result = await runSetup({
      context: mockCtx(),
    });

    expect(result.organizationId).toBe('org_1');
    expect(result.organizationName).toBe('Existing Org');
    expect(result.onboardingStatus).toBe('complete');
    expect(result.breadcrumbs).toEqual([{ action: 'View dashboard', command: result.dashboardUrl }]);
  });

  it('covers new-org creation flow through the orchestrator', async () => {
    vi.mocked(resolveOrganizationForSetup).mockResolvedValue(null);
    vi.mocked(promptOrganizationDetails).mockResolvedValue({
      name: 'Created Org',
    });
    vi.mocked(aws.discoverManagementAccountId).mockResolvedValue('111111111111');
    vi.mocked(api.createOrganization).mockResolvedValue(createdOrg);
    vi.mocked(api.getOrganization).mockResolvedValue(createdOrg);
    vi.mocked(api.verifyManagementAccount).mockResolvedValue({
      ...createdOrg,
      onboarding: 'pending',
      rootId: 'r-1234',
    });
    vi.mocked(api.verifyAccounts).mockResolvedValue({ ...createdOrg, onboarding: 'pending', rootId: 'r-1234' });

    const result = await runSetup({
      context: mockCtx(),
    });

    expect(api.createOrganization).toHaveBeenCalledWith('tok_123', 'Created Org', '111111111111');
    expect(aws.discoverManagementAccountId).toHaveBeenCalledWith(undefined);
    expect(result.organizationId).toBe('org_new');
    expect(result.organizationName).toBe('Created Org');
    expect(result.onboardingStatus).toBe('pending');
    expect(result.breadcrumbs).toEqual([
      { action: 'Check progress', command: 'milkstraw status' },
      { action: 'View dashboard', command: result.dashboardUrl },
    ]);
  });

  it('covers non-interactive existing-org setup using the shared resolver', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Existing Org',
      source: 'flag',
    });

    const result = await runSetup({
      context: mockCtx({ isInteractive: false, isTTY: false }),
      organizationFlag: 'org_1',
    });

    expect(resolveOrganizationFromContext).toHaveBeenCalled();
    expect(result.organizationId).toBe('org_1');
  });
});
