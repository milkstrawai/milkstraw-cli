import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn(),
}));

const { rethrowPermissionMock } = vi.hoisted(() => ({
  rethrowPermissionMock: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock('../../../src/context/permissions.js', () => ({
  PERMISSION_ACTIONS: { VIEW_STATUS: 'view status', UPDATE_STACKS: 'update stacks', RUN_SETUP: 'run setup' },
  rethrowOrganizationPermissionError: rethrowPermissionMock,
  withPermissionCheck: async (fn: () => Promise<unknown>, action: string, orgId: string, orgName?: string) => {
    try {
      return await fn();
    } catch (error) {
      rethrowPermissionMock(error, action, orgId, orgName);
    }
  },
}));

vi.mock('../../../src/services/status/index.js', () => ({
  getStatus: vi.fn(),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { CommandAction } from '../../../src/commands/helpers.js';
import { registerStatusCommand } from '../../../src/commands/status.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import { rethrowOrganizationPermissionError } from '../../../src/context/permissions.js';
import type { CliContext } from '../../../src/core/context.js';
import { AuthRequiredError } from '../../../src/core/errors.js';
import { getStatus } from '../../../src/services/status/index.js';

function mockSession(token: string | null = 'tok'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    isAuthenticated: vi.fn().mockResolvedValue(!!token),
  };
}

function mockContext(overrides: Partial<CliContext> = {}): CliContext {
  return {
    config: {
      apiUrl: 'https://app.milkstraw.ai',
      awsProfile: undefined,
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
  } as CliContext;
}

function getStatusHandler(): CommandAction {
  const program = new Command();
  registerStatusCommand(program);

  expect(wrapCommandMock).toHaveBeenCalledTimes(1);
  return wrapCommandMock.mock.calls[0][0] as CommandAction;
}

const statusData = {
  organization: { id: 'org_1', name: 'Test Org', onboarding: 'complete' },
  managementAccount: { accountId: '111111111111', access: 'granted' },
  managementStack: {
    name: 'ms-stack',
    status: 'CREATE_COMPLETE',
    healthy: true,
    deployedVersion: '1.0',
    latestVersion: '1.1',
  },
  stackSet: {
    name: 'ms-stackset',
    status: 'CREATE_COMPLETE',
    healthy: true,
    deployedVersion: '1.0',
    latestVersion: '1.1',
  },
  subAccounts: {
    total: 5,
    granted: 1,
    byStatus: {
      granted: [{ accountId: '222222222222' }],
      denied: [{ accountId: '333333333333' }],
      suspended: [{ accountId: '444444444444' }],
      closed: [{ accountId: '555555555555' }],
    },
  },
};

describe('commands/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws AuthRequiredError when no token is present', async () => {
    const handler = getStatusHandler();
    await expect(handler(mockContext({ auth: mockSession(null) }), {})).rejects.toThrow(AuthRequiredError);
  });

  it('passes explicit organization and aws profile to the service', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(getStatus).mockResolvedValue(statusData);

    const handler = getStatusHandler();
    const context = mockContext({
      config: { ...mockContext().config, awsProfile: 'staging-profile' },
    });
    await handler(context, { org: 'org_1' });

    expect(resolveOrganizationFromContext).toHaveBeenCalledWith(context, 'tok', 'org_1');
    expect(getStatus).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ organizationId: 'org_1' }),
      'staging-profile',
    );
  });

  it('renders grouped text status output directly from components', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(getStatus).mockResolvedValue(statusData);

    const handler = getStatusHandler();
    const context = mockContext();
    const result = await handler(context, {});

    expect(result).toBe(
      [
        'Status for Test Org',
        '',
        'Organization:',
        '  Test Org',
        '  ID org_1',
        '  Onboarding complete',
        '',
        'Management Account:',
        '  111111111111 (granted)',
        '',
        'Management Stack:',
        '  ms-stack',
        '  Healthy',
        '  Version 1.0 (latest 1.1)',
        '',
        'Stack Set:',
        '  ms-stackset',
        '  Healthy',
        '  Version 1.0 (latest 1.1)',
        '',
        'Sub Accounts:',
        '  Granted: 1',
        '  Denied: 1',
        '  Denied accounts: 333333333333',
        '  Suspended: 1',
        '  Suspended accounts: 444444444444',
        '  Closed: 1',
        '  Closed accounts: 555555555555',
      ].join('\n'),
    );
  });

  it('renders grouped markdown status output directly from components', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(getStatus).mockResolvedValue(statusData);

    const handler = getStatusHandler();
    const context = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        awsProfile: undefined,
        renderFormat: 'markdown',
        isQuiet: false,
        verbose: false,
        agentMode: false,
      },
    });
    const result = await handler(context, {});

    expect(result).toBe(
      [
        'Status for Test Org',
        '',
        '### Organization',
        '',
        '- Test Org',
        '- ID org_1',
        '- Onboarding complete',
        '',
        '### Management Account',
        '',
        '- 111111111111 (granted)',
        '',
        '### Management Stack',
        '',
        '- ms-stack',
        '- Healthy',
        '- Version 1.0 (latest 1.1)',
        '',
        '### Stack Set',
        '',
        '- ms-stackset',
        '- Healthy',
        '- Version 1.0 (latest 1.1)',
        '',
        '### Sub Accounts',
        '',
        '- Granted: 1',
        '- Denied: 1',
        '- Denied accounts: 333333333333',
        '- Suspended: 1',
        '- Suspended accounts: 444444444444',
        '- Closed: 1',
        '- Closed accounts: 555555555555',
      ].join('\n'),
    );
  });

  it('returns reduced quiet json chosen by the command', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(getStatus).mockResolvedValue(statusData);

    const handler = getStatusHandler();
    const context = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        awsProfile: undefined,
        renderFormat: 'json',
        isQuiet: true,
        verbose: false,
        agentMode: false,
      },
    });
    const result = await handler(context, {});

    expect(result).toBe(
      JSON.stringify(
        {
          organization: {
            id: 'org_1',
            name: 'Test Org',
          },
          managementStack: {
            healthy: true,
            status: 'CREATE_COMPLETE',
          },
          stackSet: {
            healthy: true,
            status: 'CREATE_COMPLETE',
          },
          subAccounts: {
            total: 5,
            statuses: {
              granted: 1,
              denied: 1,
              suspended: 1,
              closed: 1,
            },
          },
        },
        null,
        2,
      ),
    );
  });

  it('rewraps organization permission failures with organization context', async () => {
    const error = new Error('forbidden');
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(getStatus).mockRejectedValue(error);
    vi.mocked(rethrowOrganizationPermissionError).mockImplementation(() => {
      throw error;
    });

    const handler = getStatusHandler();
    await expect(handler(mockContext(), {})).rejects.toThrow('forbidden');
    expect(rethrowOrganizationPermissionError).toHaveBeenCalledWith(error, 'view status', 'org_1', 'Test Org');
  });
});
