import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapInteractiveCommandMock, rethrowPermissionMock } = vi.hoisted(() => ({
  wrapInteractiveCommandMock: vi.fn((handler: unknown) => handler),
  rethrowPermissionMock: vi.fn((error: unknown, _action?: string, _orgId?: string, _orgName?: string) => {
    throw error;
  }),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapInteractiveCommand: wrapInteractiveCommandMock,
}));

vi.mock('../../../src/context/organization.js', () => ({
  resolveOrganizationFromContext: vi.fn(),
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

vi.mock('../../../src/services/update/index.js', () => ({
  checkForUpdates: vi.fn(),
  applyUpdates: vi.fn(),
}));

vi.mock('../../../src/ui/prompts.js', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('../../../src/ui/banners.js', () => ({
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

vi.mock('../../../src/ui/progress.js', () => ({
  createProgress: vi.fn(() => progressMock),
  createProgressFromContext: vi.fn(() => progressMock),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { InteractiveAction } from '../../../src/commands/helpers.js';
import { registerUpdateCommand } from '../../../src/commands/update.js';
import { resolveOrganizationFromContext } from '../../../src/context/organization.js';
import { rethrowOrganizationPermissionError } from '../../../src/context/permissions.js';
import type { CliContext } from '../../../src/core/context.js';
import { AuthRequiredError, UsageError } from '../../../src/core/errors.js';
import { applyUpdates, checkForUpdates } from '../../../src/services/update/index.js';
import { printStep } from '../../../src/ui/banners.js';
import { confirmAction } from '../../../src/ui/prompts.js';

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

function getUpdateHandler(): InteractiveAction {
  const program = new Command();
  registerUpdateCommand(program);

  expect(wrapInteractiveCommandMock).toHaveBeenCalledTimes(1);
  return wrapInteractiveCommandMock.mock.calls[0][0] as InteractiveAction;
}

const updateCheck = {
  needsManagementUpdate: true,
  needsStackSetUpdate: false,
  updates: [{ name: 'ms-stack', from: '1.0', to: '1.1' }],
  organizationDetails: { name: 'Test Org' },
  templates: {},
};

describe('commands/update', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    progressMock.start.mockReset();
    progressMock.update.mockReset();
    progressMock.succeed.mockReset();
    progressMock.warn.mockReset();
    progressMock.fail.mockReset();
    progressMock.stop.mockReset();
  });

  it('throws UsageError when not interactive', async () => {
    const handler = getUpdateHandler();
    await expect(handler(mockContext({ isInteractive: false }), {})).rejects.toThrow(UsageError);
  });

  it('throws AuthRequiredError when no token is present', async () => {
    const handler = getUpdateHandler();
    await expect(handler(mockContext({ auth: mockSession(null) }), {})).rejects.toThrow(AuthRequiredError);
  });

  it('prints up-to-date message when no updates are needed', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(checkForUpdates).mockResolvedValue({
      needsManagementUpdate: false,
      needsStackSetUpdate: false,
      updates: [],
      organizationDetails: { name: 'Test Org' },
      templates: {},
    } as any);

    const handler = getUpdateHandler();
    await handler(mockContext(), {});

    expect(printStep).toHaveBeenCalledWith(
      'Everything is up to date.',
      expect.objectContaining({ isInteractive: true }),
    );
  });

  it('prints cancellation message when interactive confirmation is declined', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(checkForUpdates).mockResolvedValue(updateCheck as any);
    vi.mocked(confirmAction).mockResolvedValue(false);

    const handler = getUpdateHandler();
    await handler(mockContext(), {});

    expect(confirmAction).toHaveBeenCalled();
    expect(applyUpdates).not.toHaveBeenCalled();
    expect(printStep).toHaveBeenCalledWith('Update cancelled.', expect.objectContaining({ isInteractive: true }));
  });

  it('passes the resolved aws profile through update checks and apply', async () => {
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(checkForUpdates).mockResolvedValue(updateCheck as any);
    vi.mocked(confirmAction).mockResolvedValue(true);
    vi.mocked(applyUpdates).mockResolvedValue({
      updates: [{ name: 'ms-stack', status: 'updated' }],
      warnings: [],
      partialSuccess: false,
    });

    const handler = getUpdateHandler();
    await handler(
      mockContext({
        config: { ...mockContext().config, awsProfile: 'staging-profile' },
      }),
      {},
    );

    expect(checkForUpdates).toHaveBeenCalledWith('tok', expect.any(Object), 'staging-profile');
    expect(applyUpdates).toHaveBeenCalledWith('tok', expect.any(Object), updateCheck, 'staging-profile');
  });

  it('rewraps organization permission failures with organization context', async () => {
    const error = new Error('forbidden');
    vi.mocked(resolveOrganizationFromContext).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Test Org',
      source: 'flag',
    });
    vi.mocked(checkForUpdates).mockRejectedValue(error);
    vi.mocked(rethrowOrganizationPermissionError).mockImplementation(() => {
      throw error;
    });

    const handler = getUpdateHandler();
    await expect(handler(mockContext(), {})).rejects.toThrow('forbidden');
    expect(rethrowOrganizationPermissionError).toHaveBeenCalledWith(error, 'update stacks', 'org_1', 'Test Org');
  });
});
