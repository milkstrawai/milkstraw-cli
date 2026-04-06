import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapInteractiveCommandMock } = vi.hoisted(() => ({
  wrapInteractiveCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/services/auth/login.js', () => ({
  performLogin: vi.fn(),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapInteractiveCommand: wrapInteractiveCommandMock,
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { InteractiveAction } from '../../../src/commands/helpers.js';
import { registerLoginCommand } from '../../../src/commands/login.js';
import type { CliContext } from '../../../src/core/context.js';
import { UsageError } from '../../../src/core/errors.js';
import { performLogin } from '../../../src/services/auth/login.js';

function mockSession(token: string | null = 'tok'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn(),
    clearToken: vi.fn(),
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
  } as any;
}

function getLoginHandler(): InteractiveAction {
  const program = new Command();
  registerLoginCommand(program);

  expect(wrapInteractiveCommandMock).toHaveBeenCalledTimes(1);
  return wrapInteractiveCommandMock.mock.calls[0][0] as InteractiveAction;
}

describe('commands/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to performLogin', async () => {
    const loginHandler = getLoginHandler();
    vi.mocked(performLogin).mockResolvedValue('tok_root');

    await loginHandler(mockCtx(), {});

    expect(performLogin).toHaveBeenCalledWith(expect.any(Object), {
      isInteractive: true,
      agentMode: false,
    });
  });

  it('throws UsageError when not interactive', async () => {
    const loginHandler = getLoginHandler();
    await expect(loginHandler(mockCtx({ isInteractive: false }), {})).rejects.toThrow(UsageError);
  });
});
