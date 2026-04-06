import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../../src/services/organizations/index.js', () => ({
  listOrganizations: vi.fn(),
}));

import type { TokenStore } from '../../../src/auth/session.js';
import type { CommandAction } from '../../../src/commands/helpers.js';
import { registerOrgCommand } from '../../../src/commands/org.js';
import type { CliContext } from '../../../src/core/context.js';
import { AuthRequiredError } from '../../../src/core/errors.js';
import { listOrganizations } from '../../../src/services/organizations/index.js';

function mockSession(token: string | null = 'tok'): TokenStore {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    isAuthenticated: vi.fn().mockResolvedValue(!!token),
  };
}

function mockContext(overrides: Partial<CliContext> = {}): CliContext {
  const baseConfig = {
    apiUrl: 'https://app.milkstraw.ai',
    renderFormat: 'text',
    isQuiet: false,
    verbose: false,
    agentMode: false,
  };

  return {
    config: baseConfig,
    auth: mockSession(),
    transport: {} as any,
    isInteractive: true,
    isTTY: true,
    ...overrides,
  } as CliContext;
}

function getListHandler(): CommandAction {
  const program = new Command();
  registerOrgCommand(program);

  expect(wrapCommandMock).toHaveBeenCalledTimes(1);
  return wrapCommandMock.mock.calls[0][0] as CommandAction;
}

describe('commands/org', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders a text list view', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      { id: 'org_1', name: 'Org A', onboarding: 'complete', managementAccountId: '111' },
      { id: 'org_2', name: 'Org B', onboarding: 'pending', managementAccountId: '222' },
    ]);

    const handler = getListHandler();
    const result = await handler(mockContext(), {});

    expect(listOrganizations).toHaveBeenCalledWith('tok');
    expect(result).toContain('2 organizations');
    expect(result).toContain('Name  | ID    | Onboarding | Management account');
    expect(result).toContain('Org A | org_1 | complete   | 111');
    expect(result).toContain('Org B | org_2 | pending    | 222');
  });

  it('renders markdown list output directly from components', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      { id: 'org_1', name: 'Org A', onboarding: 'complete', managementAccountId: '111' },
    ]);

    const handler = getListHandler();
    const markdownContext = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        renderFormat: 'markdown',
        isQuiet: false,
        verbose: false,
        agentMode: false,
      },
    });

    const result = await handler(markdownContext, {});

    expect(result).toBe(
      '1 organization\n\n| Name | ID | Onboarding | Management account |\n| --- | --- | --- | --- |\n| Org A | org_1 | complete | 111 |',
    );
  });

  it('renders json list output directly from the command', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      { id: 'org_1', name: 'Org A', onboarding: 'complete', managementAccountId: '111' },
    ]);

    const handler = getListHandler();
    const jsonContext = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        renderFormat: 'json',
        isQuiet: false,
        verbose: false,
        agentMode: false,
      },
    });

    const result = await handler(jsonContext, {});

    expect(result).toBe(
      JSON.stringify(
        [
          {
            name: 'Org A',
            id: 'org_1',
            onboarding: 'complete',
            managementAccountId: '111',
          },
        ],
        null,
        2,
      ),
    );
  });

  it('throws auth required for org list without a token', async () => {
    const handler = getListHandler();
    await expect(handler(mockContext({ auth: mockSession(null), isInteractive: false }), {})).rejects.toThrow(
      AuthRequiredError,
    );
  });

  it('returns empty list when no organizations exist', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([]);

    const handler = getListHandler();
    const result = await handler(mockContext(), {});

    expect(result).toBe('0 organizations\n\nNo organizations found.');
  });

  it('returns reduced quiet json chosen by the command', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      { id: 'org_1', name: 'Org A', onboarding: 'complete', managementAccountId: '111' },
    ]);

    const handler = getListHandler();
    const jsonContext = mockContext({
      config: {
        apiUrl: 'https://app.milkstraw.ai',
        renderFormat: 'json',
        isQuiet: true,
        verbose: false,
        agentMode: false,
      },
    });

    const result = await handler(jsonContext, {});
    expect(result).toBe(JSON.stringify([{ id: 'org_1', name: 'Org A' }], null, 2));
  });
});
