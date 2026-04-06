import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock, wrapInteractiveCommandMock, rethrowPermissionMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler: unknown) => handler),
  wrapInteractiveCommandMock: vi.fn((handler: unknown) => handler),
  rethrowPermissionMock: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock('../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
  wrapInteractiveCommand: wrapInteractiveCommandMock,
}));

vi.mock('../../src/lib/api/index.js', () => ({
  getOrganization: vi.fn(),
  getCloudFormationTemplates: vi.fn(),
  reportStacksUpdated: vi.fn(),
  checkConnectivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/aws/index.js', () => ({
  getStackStatus: vi.fn(),
  getStackSetStatus: vi.fn(),
  updateStack: vi.fn(),
  validateCredentials: vi.fn(),
  buildManagementStackParams: vi.fn().mockReturnValue([]),
  buildStackSetWrapperParams: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/lib/organizations.js', () => ({
  summarizeSubAccounts: vi.fn(),
}));

vi.mock('../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn(),
}));

vi.mock('../../src/context/permissions.js', () => ({
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

vi.mock('../../src/ui/prompts.js', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('../../src/ui/banners.js', () => ({
  printInfo: vi.fn(),
  printStep: vi.fn(),
}));

const progressMock = vi.hoisted(() => ({
  start: vi.fn(),
  update: vi.fn(),
  succeed: vi.fn(),
  warn: vi.fn(),
  fail: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('../../src/ui/progress.js', () => ({
  createProgress: vi.fn(() => progressMock),
  createProgressFromContext: vi.fn(() => progressMock),
}));

import type { TokenStore } from '../../src/auth/session.js';
import type { CommandAction, InteractiveAction } from '../../src/commands/helpers.js';
import { registerStatusCommand } from '../../src/commands/status.js';
import { registerUpdateCommand } from '../../src/commands/update.js';
import { resolveOrganizationFromContext } from '../../src/context/organization.js';
import type { CliContext } from '../../src/core/context.js';
import * as api from '../../src/lib/api/index.js';
import * as aws from '../../src/lib/aws/index.js';
import { summarizeSubAccounts } from '../../src/lib/organizations.js';
import { confirmAction } from '../../src/ui/prompts.js';

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

function getHandlers(): { statusHandler: CommandAction; updateHandler: InteractiveAction } {
  const program = new Command();
  registerStatusCommand(program);
  registerUpdateCommand(program);

  expect(wrapCommandMock).toHaveBeenCalledTimes(1);
  expect(wrapInteractiveCommandMock).toHaveBeenCalledTimes(1);
  return {
    statusHandler: wrapCommandMock.mock.calls[0][0] as CommandAction,
    updateHandler: wrapInteractiveCommandMock.mock.calls[0][0] as InteractiveAction,
  };
}

const organizationDetails = {
  id: 'org_1',
  name: 'Acme',
  onboarding: 'complete',
  externalId: 'ext_1',
  roleName: 'Role',
  rootId: 'r-1234',
  managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  stacks: {
    managementStack: { name: 'ms-stack', version: '1.0' },
    stackset: { name: 'ms-ss', version: '1.0' },
  },
} as any;

const templates = {
  templates: {
    management: { name: 'ms-stack', version: '1.1', url: 'https://tpl/m' },
    stackset: { name: 'ms-ss', version: '1.1', url: 'https://tpl/s' },
  },
  milkstrawAccountId: '999',
} as any;

describe('status and update integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
      source: 'flag',
    });
    vi.mocked(api.getOrganization).mockResolvedValue(organizationDetails);
    vi.mocked(api.getCloudFormationTemplates).mockResolvedValue(templates);
    vi.mocked(aws.getStackStatus).mockResolvedValue({ exists: true, status: 'CREATE_COMPLETE' } as any);
    vi.mocked(aws.getStackSetStatus).mockResolvedValue({ exists: true, status: 'ACTIVE', instanceCount: 3 } as any);
    vi.mocked(aws.validateCredentials).mockResolvedValue({ accountId: '111111111111', arn: 'arn:...' } as any);
    vi.mocked(summarizeSubAccounts).mockReturnValue({
      total: 3,
      granted: 1,
      byStatus: {
        granted: [{ accountId: '222222222222' }],
        denied: [{ accountId: '333333333333' }],
        suspended: [],
        closed: [{ accountId: '444444444444' }],
      },
    } as any);
    progressMock.start.mockReset();
    progressMock.update.mockReset();
    progressMock.succeed.mockReset();
    progressMock.warn.mockReset();
  });

  it('returns command-level status output using the real service', async () => {
    const { statusHandler } = getHandlers();
    const result = await statusHandler(mockContext(), {});

    expect(result).toContain('Status for Acme');
    expect(result).toContain('Organization:\n  Acme');
    expect(result).toContain('Management Stack:\n  ms-stack');
    expect(result).toContain('Stack Set:\n  ms-ss');
    expect(result).toContain('Denied: 1');
    expect(result).toContain('Closed: 1');
  });

  it('applies updates successfully using the real service', async () => {
    vi.mocked(confirmAction).mockResolvedValue(true);
    vi.mocked(aws.updateStack).mockResolvedValue({ status: 'UPDATE_COMPLETE' } as any);
    vi.mocked(api.reportStacksUpdated).mockResolvedValue(undefined);

    const { updateHandler } = getHandlers();

    await updateHandler(mockContext(), {});
    expect(progressMock.succeed).toHaveBeenCalledWith('Stacks updated');
    expect(aws.updateStack).toHaveBeenCalledTimes(2);
  });
});
