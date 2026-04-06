import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapCommandMock } = vi.hoisted(() => ({
  wrapCommandMock: vi.fn((handler) => handler),
}));

vi.mock('../../src/commands/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/commands/helpers.js')>()),
  wrapCommand: wrapCommandMock,
}));

vi.mock('../../src/lib/api/index.js', () => ({
  listOrganizations: vi.fn(),
}));

import type { TokenStore } from '../../src/auth/session.js';
import type { CommandAction } from '../../src/commands/helpers.js';
import { registerOrgCommand } from '../../src/commands/org.js';
import type { CliContext } from '../../src/core/context.js';
import * as api from '../../src/lib/api/index.js';

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

function getListHandler(): CommandAction {
  const program = new Command();
  registerOrgCommand(program);

  expect(wrapCommandMock).toHaveBeenCalledTimes(1);
  return wrapCommandMock.mock.calls[0][0] as CommandAction;
}

const organizations = [
  {
    id: 'org_1',
    name: 'Org One',
    onboarding: 'complete',
    managementAccount: { id: 'acc_1', accountId: '111111111111', nickname: '', access: 'granted' },
  },
  {
    id: 'org_2',
    name: 'Org Two',
    onboarding: 'pending',
    managementAccount: { id: 'acc_2', accountId: '222222222222', nickname: '', access: 'granted' },
  },
];

describe('organization commands integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.listOrganizations).mockResolvedValue(organizations as any);
  });

  it('lists accessible organizations through command and service layers', async () => {
    const handler = getListHandler();
    const result = await handler(mockContext(), {});

    expect(result).toContain('2 organizations');
    expect(result).toContain('Org One | org_1 | complete   | 111111111111');
    expect(result).toContain('Org Two | org_2 | pending    | 222222222222');
  });
});
