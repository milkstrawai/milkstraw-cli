import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock, wrapInteractiveCommandMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  wrapInteractiveCommandMock: vi.fn((handler) => handler),
}));

const progressMock = vi.hoisted(() => ({
  start: vi.fn(),
  update: vi.fn(),
  succeed: vi.fn(),
  warn: vi.fn(),
  fail: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('open', () => ({
  default: openMock,
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapInteractiveCommand: wrapInteractiveCommandMock,
}));

vi.mock('../../../src/services/setup/run-setup.js', () => ({
  runSetup: vi.fn(),
}));

const { setTimeoutMock } = vi.hoisted(() => ({
  setTimeoutMock: vi.fn(),
}));

vi.mock('node:timers/promises', () => ({
  setTimeout: setTimeoutMock,
}));

vi.mock('../../../src/ui/banners.js', () => ({
  printBanner: vi.fn(),
  printCompletionBox: vi.fn(),
  printSubtle: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
}));

vi.mock('../../../src/ui/progress.js', () => ({
  createProgress: vi.fn(() => progressMock),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { InteractiveAction } from '../../../src/commands/helpers.js';
import { registerSetupCommand } from '../../../src/commands/setup.js';
import type { CliContext } from '../../../src/core/context.js';
import { UsageError } from '../../../src/core/errors.js';
import { runSetup } from '../../../src/services/setup/run-setup.js';
import { printBanner, printCompletionBox, printSubtle, printSuccess, printWarning } from '../../../src/ui/banners.js';
import { createProgress } from '../../../src/ui/progress.js';

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

function getSetupHandler(): InteractiveAction {
  const program = new Command();
  registerSetupCommand(program);

  expect(wrapInteractiveCommandMock).toHaveBeenCalledTimes(1);
  return wrapInteractiveCommandMock.mock.calls[0][0] as InteractiveAction;
}

describe('commands/setup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws UsageError when not interactive', async () => {
    const handler = getSetupHandler();
    await expect(handler(mockContext({ isInteractive: false }), {})).rejects.toThrow(UsageError);
  });

  it('passes command options through to runSetup, renders setup progress, and opens dashboard', async () => {
    vi.mocked(runSetup).mockImplementation(async (input) => {
      input.onStepStart?.('Deploying management stack');
      input.onProgress?.('Deploying management stack...');
      input.onProgress?.('Deploying StackSet... 2/3 accounts (14s)');
      input.onStepSuccess?.('Management stack ready');
      input.onInfo?.('This may take a minute.');
      input.onStepSuccess?.('Subaccounts verified');

      return {
        organizationId: 'org_1',
        organizationName: 'Acme',
        dashboardUrl: 'https://app.milkstraw.ai/orgs/org_1',
        onboardingStatus: 'pending',
        breadcrumbs: [{ action: 'View dashboard', command: 'https://app.milkstraw.ai/orgs/org_1' }],
        notices: ['Notice'],
        warnings: ['Warning'],
      };
    });

    const handler = getSetupHandler();
    const context = mockContext({
      config: { ...mockContext().config, awsProfile: 'staging-profile' },
    });

    await handler(context, { org: 'org_flag' });

    expect(printBanner).toHaveBeenCalledWith(
      'MilkStraw AI - CLI Setup',
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(runSetup).toHaveBeenCalledWith({
      context,
      organizationFlag: 'org_flag',
      awsProfile: 'staging-profile',
      onStepStart: expect.any(Function),
      onStepSuccess: expect.any(Function),
      onInfo: expect.any(Function),
      onWarning: expect.any(Function),
      onProgress: expect.any(Function),
    });
    expect(createProgress).toHaveBeenCalledWith(expect.objectContaining({ isInteractive: true, agentMode: false }));
    expect(progressMock.start).toHaveBeenCalledWith('Deploying management stack');
    expect(progressMock.update).toHaveBeenCalledWith('Deploying StackSet... 2/3 accounts (14s)');
    expect(progressMock.succeed).toHaveBeenCalledWith('Management stack ready');
    expect(progressMock.stop).not.toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalledWith(
      'Subaccounts verified',
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(printSubtle).toHaveBeenCalledWith(
      'This may take a minute.',
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(printSubtle).toHaveBeenCalledWith(
      'Notice',
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(printWarning).toHaveBeenCalledWith(
      'Warning',
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(printCompletionBox).toHaveBeenCalledWith(
      ['Setup complete!', 'Status: pending', 'Dashboard: https://app.milkstraw.ai/orgs/org_1'],
      expect.objectContaining({ isInteractive: true, agentMode: false }),
    );
    expect(setTimeoutMock).toHaveBeenCalledWith(1000);
    expect(openMock).toHaveBeenCalledWith('https://app.milkstraw.ai/orgs/org_1');
  });

  it('stops progress output when setup fails', async () => {
    vi.mocked(runSetup).mockImplementation(async (input) => {
      input.onProgress?.('Deploying management stack...');
      throw new Error('deployment failed');
    });

    const handler = getSetupHandler();

    await expect(handler(mockContext(), {})).rejects.toThrow('deployment failed');
    expect(progressMock.start).toHaveBeenCalledWith('Deploying management stack...');
    expect(progressMock.stop).toHaveBeenCalled();
  });

  it('swallows dashboard open failures after successful setup', async () => {
    vi.mocked(runSetup).mockResolvedValue({
      organizationId: 'org_1',
      organizationName: 'Acme',
      dashboardUrl: 'https://app.milkstraw.ai/orgs/org_1',
      onboardingStatus: 'complete',
      breadcrumbs: [],
      notices: undefined,
      warnings: undefined,
    });
    openMock.mockRejectedValue(new Error('launch failed'));

    const handler = getSetupHandler();
    // Should not throw even though open() rejects
    await handler(mockContext(), {});

    expect(setTimeoutMock).toHaveBeenCalledWith(1000);
    expect(openMock).toHaveBeenCalledWith('https://app.milkstraw.ai/orgs/org_1');
  });
});
