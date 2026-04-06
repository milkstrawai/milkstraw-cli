import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../../src/services/auth/logout.js', () => ({
  performLogout: vi.fn(),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { CommandAction } from '../../../src/commands/helpers.js';
import { registerLogoutCommand } from '../../../src/commands/logout.js';
import type { CliContext } from '../../../src/core/context.js';
import { performLogout } from '../../../src/services/auth/logout.js';

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
      renderFormat: 'text',
      verbose: false,
      agentMode: false,
      isQuiet: false,
    },
    auth: mockSession(),
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
    ...overrides,
  } as CliContext;
}

function getLogoutHandler(): CommandAction {
  const program = new Command();
  registerLogoutCommand(program);

  expect(wrapCommandMock).toHaveBeenCalledTimes(1);
  return wrapCommandMock.mock.calls[0][0] as CommandAction;
}

describe('commands/logout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders a text mutation summary when revoke succeeds', async () => {
    vi.mocked(performLogout).mockResolvedValue({ revoked: true, localCleared: true });

    const handler = getLogoutHandler();
    const context = mockContext();
    const result = await handler(context, {});

    expect(performLogout).toHaveBeenCalledWith(context.auth);
    expect(result).toBe('Token revoked. Logged out.');
  });

  it('renders structured json directly when json is requested', async () => {
    vi.mocked(performLogout).mockResolvedValue({ revoked: true, localCleared: true });

    const handler = getLogoutHandler();
    const context = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        renderFormat: 'json',
        isQuiet: false,
        verbose: false,
        agentMode: false,
      },
    });
    const result = await handler(context, {});

    expect(result).toBe(JSON.stringify({ loggedOut: true, revoked: true }, null, 2));
  });

  it('renders an idempotent mutation summary when already logged out', async () => {
    vi.mocked(performLogout).mockResolvedValue({ revoked: false, localCleared: false });

    const handler = getLogoutHandler();
    const result = await handler(mockContext({ auth: mockSession(null) }), {});

    expect(result).toBe('Already logged out.');
  });

  it('renders a mutation summary when remote revocation fails after clearing local credentials', async () => {
    vi.mocked(performLogout).mockResolvedValue({ revoked: false, localCleared: true });

    const handler = getLogoutHandler();
    const result = await handler(mockContext(), {});

    expect(result).toBe('Logged out.');
  });

  it('returns reduced quiet json chosen by the command', async () => {
    vi.mocked(performLogout).mockResolvedValue({ revoked: true, localCleared: true });

    const handler = getLogoutHandler();
    const context = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        renderFormat: 'json',
        isQuiet: true,
        verbose: false,
        agentMode: false,
      },
    });
    const result = await handler(context, {});

    expect(result).toBe(JSON.stringify({ loggedOut: true, revoked: true }, null, 2));
  });
});
